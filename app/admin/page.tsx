import { env } from "cloudflare:workers";
import Link from "next/link";
import { Archive, BriefcaseBusiness, CalendarDays, Clock3, Inbox, LogOut, Store, Tag } from "lucide-react";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { ensureRuntimeSchema } from "../../db/runtime";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Administrare", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const allowed = env.ADMIN_EMAIL && user.email.toLowerCase() === String(env.ADMIN_EMAIL).toLowerCase();
  if (!allowed) return <section className="container admin-denied"><h1>Administrarea este protejată</h1><p>Contul conectat nu se află în lista administratorilor. Variabila sigură <code>ADMIN_EMAIL</code> trebuie configurată de proprietarul site-ului.</p><Link className="button" href="/">Înapoi la site</Link></section>;
  const db = await ensureRuntimeSchema();
  const pending = await db.prepare("SELECT COUNT(*) count FROM submissions WHERE status='pending_review'").first<{ count: number }>();
  const content = await db.prepare("SELECT type, COUNT(*) count FROM content_items GROUP BY type").all<{ type: string; count: number }>();
  const counts = Object.fromEntries(content.results.map(x => [x.type, x.count]));
  const cards = [["Trimiteri în așteptare", pending?.count || 0, Inbox], ["Afaceri active", counts.business || 0, Store], ["Evenimente viitoare", counts.event || 0, CalendarDays], ["Oferte active", counts.offer || 0, Tag], ["Joburi active", counts.job || 0, BriefcaseBusiness], ["Expirate de revizuit", 0, Archive]] as const;
  return <section className="admin-shell"><aside><div className="logo"><span>Blaj</span><b>Azi</b></div><p>Administrare</p><nav><a className="active" href="#rezumat">Rezumat</a><a href="#trimiteri">Trimiteri</a><a href="#continut">Conținut</a><a href="#media">Media și atribuiri</a><a href="#newsletter">Newsletter</a></nav><a href={chatGPTSignOutPath("/")}><LogOut /> Ieșire</a></aside><div className="admin-content"><header><div><p className="eyebrow">Panou de control</p><h1>Bun venit, {user.displayName}</h1></div><Link className="button" href="/">Vezi site-ul</Link></header><div className="admin-cards" id="rezumat">{cards.map(([title, value, Icon]) => <article key={title}><Icon /><strong>{value}</strong><span>{title}</span></article>)}</div><section className="admin-panel" id="trimiteri"><div><h2>Flux de moderare</h2><p>Orice trimitere publică rămâne nepublicată până la o decizie explicită.</p></div><div className="moderation-steps"><span><Clock3 /> În așteptare</span><Arrow /><span>Necesită modificări</span><Arrow /><span>Aprobat</span><Arrow /><span>Publicat</span></div></section></div></section>;
}
function Arrow() { return <span aria-hidden="true">→</span>; }
