import { env } from "cloudflare:workers";
import { ensureRuntimeSchema } from "../../../db/runtime";

const allowedTypes = new Set(["business", "event", "offer", "job", "contribution", "contact", "promotion", "newsletter"]);
const allowedMedia = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const type = String(form.get("type") || "");
    const email = String(form.get("email") || "").trim().slice(0, 200);
    if (!allowedTypes.has(type) || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Date invalide" }, { status: 400 });
    if (form.get("website")) return Response.json({ ok: true });
    const consent = form.get("consent") ? 1 : 0;
    if (!consent) return Response.json({ error: "Consimțământ necesar" }, { status: 400 });
    const db = await ensureRuntimeSchema();
    if (type === "newsletter") {
      const interests = form.getAll("interests").map(String).slice(0, 10).join(", ");
      await db.prepare(`INSERT INTO newsletter_subscriptions (email, interests, status) VALUES (?, ?, 'pending_confirmation') ON CONFLICT(email) DO UPDATE SET interests=excluded.interests, status='pending_confirmation'`).bind(email, interests).run();
      return Response.json({ ok: true, status: "pending_confirmation" });
    }
    let mediaKey: string | null = null;
    const media = form.get("media");
    if (media instanceof File && media.size) {
      if (!allowedMedia.has(media.type) || media.size > 8 * 1024 * 1024) return Response.json({ error: "Fișier neacceptat" }, { status: 400 });
      mediaKey = `submissions/${crypto.randomUUID()}`;
      await env.MEDIA.put(mediaKey, media.stream(), { httpMetadata: { contentType: media.type }, customMetadata: { originalName: media.name.slice(0, 180) } });
    }
    const value = (key: string, max = 4000) => String(form.get(key) || "").trim().slice(0, max);
    await db.prepare(`INSERT INTO submissions (type, contributor_name, email, title, locality, category, description, source_url, media_key, rights_confirmed, consent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_review')`).bind(type, value("name", 180), email, value("title", 240), value("locality", 100), value("category", 120), value("description"), value("source", 800), mediaKey, form.get("rights") ? 1 : 0).run();
    return Response.json({ ok: true, status: "pending_review" });
  } catch (error) {
    console.error("submission_failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Nu am putut salva trimiterea" }, { status: 500 });
  }
}
