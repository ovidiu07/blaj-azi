import { env } from "cloudflare:workers";
import { getRuntimeDb } from "../../../db/runtime";
import { assertSameOrigin, getOptionalAccount } from "../../server/platform";

const allowedTypes = new Set(["business", "event", "offer", "job", "contribution", "contact", "promotion", "newsletter"]);
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
    const email = String(form.get("email") || "").trim().slice(0, 200);
    if (!allowedTypes.has(type) || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Date invalide" }, { status: 400 });
    if (form.get("website")) return Response.json({ ok: true });
    const consent = form.get("consent") ? 1 : 0;
    if (!consent) return Response.json({ error: "Consimțământ necesar" }, { status: 400 });
    const db = getRuntimeDb();
    const account = await getOptionalAccount();
    if (type === "newsletter") {
      const interests = form.getAll("interests").map(String).slice(0, 10).join(", ");
      await db.prepare(`INSERT INTO newsletter_subscriptions (email, interests, status) VALUES (?, ?, 'pending_confirmation') ON CONFLICT(email) DO UPDATE SET interests=excluded.interests, status='pending_confirmation'`).bind(email, interests).run();
      return Response.json({ ok: true, status: "pending_confirmation" });
    }
    if(type==="contact"){
      const reason=String(form.get("description")||"").trim().slice(0,4000);
      await db.batch([
        db.prepare("INSERT INTO content_reports (email,reason,reporter_user_id,status) VALUES (?,?,?,'new')").bind(account?.email||email,reason,account?.id??null),
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
    const value = (key: string, max = 4000) => String(form.get(key) || "").trim().slice(0, max);
    await db.prepare(`INSERT INTO submissions (type, contributor_name, email, title, locality, category, description, source_url, media_key, rights_confirmed, consent, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_review', ?)`).bind(type, account?.displayName || value("name", 180), account?.email || email, value("title", 240), value("locality", 100), value("category", 120), value("description"), value("source", 800), mediaKey, form.get("rights") ? 1 : 0, account?.id ?? null).run();
    return Response.json({ ok: true, status: "pending_review" });
  } catch (error) {
    console.error("submission_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Nu am putut salva trimiterea" }, { status: 500 });
  }
}
