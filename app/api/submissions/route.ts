import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../db/runtime";
import { submitAuthenticatedEvent } from "../../server/content";
import { assertSameOrigin, getOptionalAccount, jsonError } from "../../server/platform";
import { richTextToPlainText } from "../../rich-text";

const allowedTypes = new Set(["business", "event", "offer", "job", "contribution", "contact", "newsletter"]);
const payloadFields: Record<string, string[]> = {
  business: ["address", "serviceArea", "phone", "contactEmail", "businessWebsite", "hours", "accessibility", "ownershipEvidence"],
  event: ["startsAt", "endsAt", "venue", "address", "organizer", "contact", "price", "bookingUrl", "accessibility"],
  offer: ["businessName", "currentPrice", "oldPrice", "validFrom", "validUntil", "terms", "redemption"],
  job: ["employer", "employmentType", "schedule", "salary", "applicationMethod", "deadline", "requirements", "benefits", "transport"],
  contribution: ["contributionType", "eventDate", "location", "author", "photographer", "license", "altText"],
  contact: ["issueType"],
};

function clean(form: FormData, key: string, max = 4000) {
  return String(form.get(key) || "").trim().slice(0, max);
}

function cleanNarrative(form: FormData, key: string, max = 4000) {
  const value = form.get(key);
  try { return richTextToPlainText(value).slice(0, max); }
  catch { return clean(form, key, max); }
}

function validateTypePayload(type: string, form: FormData) {
  const required: Record<string, string[]> = {
    business: ["title", "locality", "description", "address", "phone"],
    event: ["title", "category", "locality", "description", "startsAt", "venue", "organizer"],
    offer: ["title", "description", "businessName", "currentPrice", "validFrom", "validUntil", "terms"],
    job: ["title", "locality", "description", "employer", "employmentType", "applicationMethod", "deadline"],
    contribution: ["title", "description", "contributionType", "author", "license"],
    contact: ["description", "issueType"],
  };
  const narratives = new Set(["description", "terms", "requirements", "benefits"]);
  const missing = (required[type] || []).find((key) => !(narratives.has(key) ? cleanNarrative(form, key) : clean(form, key)));
  if (missing) return `Câmp obligatoriu lipsă: ${missing}`;
  if (type === "event" && Number.isNaN(Date.parse(clean(form, "startsAt")))) return "Data evenimentului nu este validă.";
  if (type === "offer" && (Number(clean(form, "currentPrice")) < 0 || Date.parse(clean(form, "validUntil")) < Date.parse(clean(form, "validFrom")))) return "Perioada sau prețul ofertei nu este valid.";
  if (type === "job" && Number.isNaN(Date.parse(clean(form, "deadline")))) return "Termenul de aplicare nu este valid.";
  return null;
}
function validImage(bytes: Uint8Array) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value);
  const webp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const type = String(form.get("type") || "");
    const account = await getOptionalAccount();
    const email = String(account?.email || form.get("email") || "").trim().slice(0, 200);
    if (!allowedTypes.has(type) || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Date invalide" }, { status: 400 });
    if (form.get("website")) return Response.json({ ok: true });
    const consent = form.get("consent") ? 1 : 0;
    if (!consent) return Response.json({ error: "Consimțământ necesar" }, { status: 400 });
    const db = getRuntimeDb();
    if (type === "newsletter") {
      const interests = form.getAll("interests").map(String).slice(0, 10).join(", ");
      await db.prepare(`INSERT INTO newsletter_subscriptions (email, interests, status) VALUES (?, ?, 'pending_confirmation') ON CONFLICT(email) DO UPDATE SET interests=excluded.interests, status='pending_confirmation'`).bind(email, interests).run();
      return Response.json({ ok: true, status: "pending_confirmation" });
    }
    const validationError = validateTypePayload(type, form);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    if (type !== "contact" && !form.get("rights")) return Response.json({ error: "Confirmarea drepturilor este obligatorie." }, { status: 400 });
    if (type === "event" && account) {
      const submitted = await submitAuthenticatedEvent(account, {
        title: form.get("title"), locality: form.get("locality"), category: form.get("category"),
        description: form.get("description"), sourceUrl: form.get("source"), startsAt: form.get("startsAt"),
        endsAt: form.get("endsAt"), venue: form.get("venue"), address: form.get("address"),
        organizer: form.get("organizer"), price: form.get("price"), bookingUrl: form.get("bookingUrl"),
        accessibility: form.get("accessibility"), rightsConfirmed: form.get("rights"), consent: form.get("consent"),
      });
      return Response.json({ ok: true, ...submitted }, { status: 201 });
    }
    let target: { id:number;type:string;title:string;slug:string } | null = null;
    if(type==="contact"){
      const reason=clean(form,"description");
      const targetContentId=Number(form.get("targetContentId"))||0;
      if(targetContentId){
        target=await db.prepare("SELECT id,type,title,slug FROM content_records WHERE id=? AND status='published' AND visibility='public' AND deleted_at IS NULL").bind(targetContentId).first<{id:number;type:string;title:string;slug:string}>()||null;
        if(!target)return Response.json({error:"Conținutul raportat nu este public sau nu există."},{status:400});
      }
      await db.batch([
        db.prepare("INSERT INTO content_reports (entity_type,entity_id,email,reason,reporter_user_id,status) VALUES (?,?,?,?,?,'new')").bind(target?.type||null,target?.id||null,account?.email||email,reason,account?.id??null),
        db.prepare("INSERT INTO contact_messages (name,email,message,status) VALUES (?,?,?,'new')").bind(account?.displayName||String(form.get("name")||"").slice(0,180),account?.email||email,reason),
      ]);
    }
    let mediaKey: string | null = null;
    const media = form.get("media");
    if (media instanceof File && media.size) {
      if (media.size > 8 * 1024 * 1024) return Response.json({ error: "Fișier neacceptat" }, { status: 400 });
      const bytes = new Uint8Array(await media.arrayBuffer());
      const detected = validImage(bytes);
      if (!detected) return Response.json({ error: "Fișier neacceptat" }, { status: 400 });
      const extension = detected === "image/jpeg" ? "jpg" : detected === "image/png" ? "png" : "webp";
      mediaKey = `submissions/${crypto.randomUUID()}.${extension}`;
      await env.MEDIA.put(mediaKey, bytes, { httpMetadata: { contentType: detected }, customMetadata: { originalName: media.name.slice(0, 180), ownerUserId: account ? String(account.id) : "anonymous" } });
    }
    const payload = Object.fromEntries((payloadFields[type] || []).map((key) => [key, ["terms", "requirements", "benefits"].includes(key) ? cleanNarrative(form, key, 1000) : clean(form, key, 1000)]).filter(([, value]) => value));
    if (target) Object.assign(payload, { targetContentId:target.id, targetType:target.type, targetTitle:target.title, targetSlug:target.slug });
    const result=await db.prepare(`INSERT INTO submissions (type, contributor_name, email, title, locality, category, description, source_url, media_key, payload, rights_confirmed, consent, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_review', ?)`).bind(type, account?.displayName || clean(form,"name",180), account?.email || email, clean(form,"title",240), clean(form,"locality",100), clean(form,"category",120), cleanNarrative(form,"description"), clean(form,"source",800), mediaKey, JSON.stringify(payload), form.get("rights") ? 1 : 0, account?.id ?? null).run();
    return Response.json({ ok:true, status:"pending_review", reference:`BA-${String(result.meta.last_row_id).padStart(6,"0")}`, id:result.meta.last_row_id }, { status:201 });
  } catch (error) {
    console.error("submission_failed", error instanceof Error ? error.message : "unknown");
    return jsonError(error);
  }
}
