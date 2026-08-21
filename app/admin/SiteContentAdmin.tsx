"use client";

/* eslint-disable @next/next/no-img-element -- CMS previews use runtime D1/R2 media URLs. */

import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, History, Image as ImageIcon, Plus, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSiteContentEntry } from "../server/site-content";
import type { CmsField, CmsImage, RichTextBlock } from "../site-content";
import { cmsImageUrl, resolveCmsImage } from "../site-content";

type Revision = { id: number; revision_number: number; action: string; created_at: string; actor_name: string | null; snapshot: string };
type MediaItem = { id: number; title: string | null; original_filename: string | null; alt_text: string | null; photographer: string | null; source_url: string | null; license: string | null; approval_status: string; media_status: string };

export function SiteContentIndex({ entries }: { entries: AdminSiteContentEntry[] }) {
  const groups = useMemo(() => Array.from(new Set(entries.map(entry => entry.group))), [entries]);
  return <div className="cms-groups">{groups.map(group => <section className="cms-group" key={group}><h2>{group}</h2><div className="cms-entry-grid">{entries.filter(entry => entry.group === group).map(entry => <Link className="cms-entry-card" href={`/admin/pagini/${encodeURIComponent(entry.key)}`} key={entry.key}><div><span className={`status-pill ${entry.hasDraftChanges ? "status-pending_review" : "status-published"}`}>{entry.hasDraftChanges ? "Ciornă nepublicată" : "Publicat"}</span><h3>{entry.label}</h3><p>{entry.route}</p></div><small>{entry.updatedAt ? `Actualizat ${formatDate(entry.updatedAt)}` : "Conținut implicit"}</small></Link>)}</div></section>)}</div>;
}

export function SiteContentEditor({ initial, revisions: initialRevisions }: { initial: AdminSiteContentEntry; revisions: Revision[] }) {
  const [content, setContent] = useState<Record<string, unknown>>(initial.draft);
  const [version, setVersion] = useState(initial.version);
  const [savedContent, setSavedContent] = useState(JSON.stringify(initial.draft));
  const [revisions, setRevisions] = useState(initialRevisions);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(content) !== savedContent;

  async function saveDraft() {
    setBusy("save"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/site-content/${encodeURIComponent(initial.key)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, version }) });
    const data = await response.json() as { error?: string; version?: number; draft?: Record<string, unknown> };
    if (!response.ok) { setError(data.error || "Ciorna nu a putut fi salvată."); setBusy(""); return null; }
    const nextContent = data.draft || content;
    setContent(nextContent); setSavedContent(JSON.stringify(nextContent)); setVersion(Number(data.version)); setMessage("Ciorna a fost salvată."); setBusy("");
    await refreshRevisions();
    return Number(data.version);
  }

  async function action(name: "publish" | "discard" | "restore", revisionId?: number) {
    if ((name === "discard" || name === "restore") && !confirm(name === "discard" ? "Renunți la modificările nepublicate?" : "Restaurezi și publici această revizie?")) return;
    let currentVersion = version;
    if (name === "publish" && dirty) { const savedVersion = await saveDraft(); if (!savedVersion) return; currentVersion = savedVersion; }
    setBusy(name); setError(""); setMessage("");
    const response = await fetch(`/api/admin/site-content/${encodeURIComponent(initial.key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: name, version: currentVersion, revisionId }) });
    const data = await response.json() as { error?: string; version?: number };
    if (!response.ok) { setError(data.error || "Acțiunea nu a putut fi finalizată."); setBusy(""); return; }
    setMessage(name === "publish" ? "Modificările sunt publice." : name === "restore" ? "Revizia a fost restaurată și publicată." : "Ciorna a fost eliminată.");
    setVersion(Number(data.version)); setBusy(""); location.reload();
  }

  async function refreshRevisions() {
    const response = await fetch(`/api/admin/site-content/${encodeURIComponent(initial.key)}`);
    if (response.ok) { const data = await response.json() as { revisions: Revision[] }; setRevisions(data.revisions); }
  }

  return <div className="cms-editor-layout"><section>
    <div className="cms-editor-meta"><span className={`status-pill ${initial.hasDraftChanges || dirty ? "status-pending_review" : "status-published"}`}>{initial.hasDraftChanges || dirty ? "Ciornă" : "Publicat"}</span><span>Versiunea {version}</span><span>Ultima editare: {initial.updatedByName || "sistem"}{initial.updatedAt ? ` · ${formatDate(initial.updatedAt)}` : ""}</span><span>Ultima publicare: {initial.publishedByName || "migrare"}{initial.publishedAt ? ` · ${formatDate(initial.publishedAt)}` : ""}</span></div>
    {error && <div className="form-alert form-alert-error" role="alert"><strong>Verifică modificările.</strong><p>{error}</p></div>}
    {message && <p className="success-message" role="status">{message}</p>}
    <form className="cms-editor-form" onSubmit={event => { event.preventDefault(); void saveDraft(); }}>
      {initial.fields.map(field => <FieldEditor key={field.path} field={field} value={content[field.path]} onChange={value => setContent(current => ({ ...current, [field.path]: value }))} />)}
      <div className="cms-sticky-actions"><button className="button" disabled={Boolean(busy) || !dirty} type="submit"><Save />{busy === "save" ? "Se salvează…" : "Salvează ciorna"}</button><Link className="button button-outline" target="_blank" href={`/admin/previzualizare/${encodeURIComponent(initial.key)}`}><Eye />Previzualizează</Link><button className="button" disabled={Boolean(busy)} type="button" onClick={() => action("publish")}><Send />{busy === "publish" ? "Se publică…" : "Publică"}</button><button className="button button-outline" disabled={Boolean(busy) || (!initial.hasDraftChanges && !dirty)} type="button" onClick={() => action("discard")}><X />Renunță la ciornă</button></div>
    </form>
  </section><aside className="cms-history"><h2><History /> Istoric revizii</h2>{revisions.map(revision => <article key={revision.id}><strong>Revizia {revision.revision_number}</strong><span>{revisionLabel(revision.action)}</span><small>{revision.actor_name || "Sistem"} · {formatDate(revision.created_at)}</small><button type="button" onClick={() => action("restore", revision.id)} disabled={Boolean(busy)}><RotateCcw />Restaurează și publică</button></article>)}{!revisions.length && <p>Istoricul va apărea după prima salvare.</p>}</aside></div>;
}

function FieldEditor({ field, value, onChange }: { field: CmsField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === "toggle") return <label className="cms-toggle"><input type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.kind === "image") return <ImageField label={field.label} value={resolveCmsImage(value)} onChange={onChange} />;
  if (field.kind === "repeatable") return <RepeatableField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />;
  if (field.kind === "richtext") return <RichTextField label={field.label} value={Array.isArray(value) ? value as RichTextBlock[] : []} onChange={onChange} />;
  if (field.kind === "enum") return <label>{field.label}<select value={String(value || "")} required={field.required} onChange={event => onChange(event.target.value)}>{!field.required && <option value="">—</option>}{field.options?.map(option => <option key={option}>{option}</option>)}</select></label>;
  const common = { value: String(value || ""), required: field.required, maxLength: field.maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label>{field.label}{field.help && <small>{field.help}</small>}{field.kind === "multiline" ? <textarea {...common} rows={5} /> : <input {...common} type={field.kind === "external-url" ? "url" : "text"} />}</label>;
}

function RepeatableField({ field, value, onChange }: { field: CmsField; value: unknown[]; onChange: (value: unknown) => void }) {
  function itemValue(item: unknown) { return typeof item === "string" ? { value: item } : item && typeof item === "object" ? item as Record<string, unknown> : {}; }
  return <fieldset className="cms-repeatable"><legend>{field.label}</legend>{value.map((rawItem, index) => { const item = itemValue(rawItem); return <article key={index}><header><strong>Element {index + 1}</strong><div><button type="button" aria-label="Mută mai sus" disabled={index === 0} onClick={() => onChange(move(value, index, index - 1))}><ArrowUp /></button><button type="button" aria-label="Mută mai jos" disabled={index === value.length - 1} onClick={() => onChange(move(value, index, index + 1))}><ArrowDown /></button><button type="button" aria-label="Elimină" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div></header>{field.itemFields?.map(itemField => <FieldEditor key={itemField.path} field={itemField.kind === "enum" && !itemField.options ? { ...itemField, options: field.options } : itemField} value={item[itemField.path]} onChange={next => onChange(value.map((entry, itemIndex) => itemIndex === index ? { ...itemValue(entry), [itemField.path]: next } : entry))} />)}</article>; })}<button className="button button-outline" type="button" onClick={() => onChange([...value, Object.fromEntries((field.itemFields || []).map(item => [item.path, item.kind === "toggle" ? true : item.kind === "repeatable" || item.kind === "richtext" ? [] : item.kind === "image" ? resolveCmsImage(null) : ""]))])}><Plus />Adaugă element</button></fieldset>;
}

function RichTextField({ label, value, onChange }: { label: string; value: RichTextBlock[]; onChange: (value: unknown) => void }) {
  const types = { paragraph: "Paragraf", heading2: "Titlu nivel 2", heading3: "Titlu nivel 3", "bulleted-list": "Listă cu marcatori", "numbered-list": "Listă numerotată", quote: "Citat", link: "Link" };
  return <fieldset className="cms-repeatable"><legend>{label}</legend>{value.map((block, index) => <article key={index}><header><strong>Bloc {index + 1}</strong><button type="button" aria-label="Elimină blocul" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></header><label>Tip<select value={block.type} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as RichTextBlock["type"] } : item))}>{Object.entries(types).map(([type, name]) => <option value={type} key={type}>{name}</option>)}</select></label><label>Text<textarea rows={4} value={block.text} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /></label>{block.type === "link" && <label>Link sigur<input value={block.href || ""} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))} /></label>}</article>)}<button className="button button-outline" type="button" onClick={() => onChange([...value, { type: "paragraph", text: "" }])}><Plus />Adaugă bloc</button></fieldset>;
}

function ImageField({ label, value, onChange }: { label: string; value: CmsImage; onChange: (value: unknown) => void }) {
  const [selector, setSelector] = useState(false); const [media, setMedia] = useState<MediaItem[]>([]); const [query, setQuery] = useState(""); const [uploading, setUploading] = useState(false); const [error, setError] = useState(""); const dialog = useRef<HTMLDivElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!selector) return; void fetch("/api/media?scope=all").then(response => response.json()).then((data: { items?: MediaItem[] }) => setMedia(data.items || [])); }, [selector]);
  useEffect(() => { if (!selector || !dialog.current) return; const node = dialog.current; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelector(false); }; node.addEventListener("keydown", close); node.querySelector<HTMLElement>("button,input")?.focus(); return () => node.removeEventListener("keydown", close); }, [selector]);
  const set = (patch: Partial<CmsImage>) => onChange({ ...value, ...patch });
  async function upload() { const file = fileInput.current?.files?.[0]; if (!file) { setError("Alege o imagine înainte de încărcare."); return; } setUploading(true); setError(""); const form = new FormData(); form.set("file", file); for (const key of ["altText", "photographer", "sourceUrl", "license"]) form.set(key, key === "altText" ? value.alt : key === "photographer" ? value.author : key === "sourceUrl" ? value.sourceUrl : value.license); const response = await fetch("/api/media", { method: "POST", body: form }); const data = await response.json() as { id?: number; error?: string }; if (!response.ok || !data.id) { setError(data.error || "Imaginea nu a putut fi încărcată."); setUploading(false); return; } const approve = await fetch(`/api/media/${data.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", altText: value.alt, photographer: value.author, sourceUrl: value.sourceUrl, license: value.license }) }); if (!approve.ok) { setError("Imaginea a fost încărcată, dar nu a putut fi aprobată."); setUploading(false); return; } set({ mediaId: data.id, src: "" }); setUploading(false); setSelector(false); }
  return <fieldset className="cms-image-field"><legend>{label}</legend>{(value.mediaId || value.src) && <img src={cmsImageUrl(value)} alt={value.decorative ? "" : value.alt} style={{ objectPosition: value.objectPosition }} width="720" height="420" />}<div className="editor-grid"><label>Cale imagine existentă<input value={value.src} placeholder="/images/exemplu.jpg" onChange={event => set({ src: event.target.value, mediaId: null })} /></label><label>Poziționare<select value={value.objectPosition} onChange={event => set({ objectPosition: event.target.value as CmsImage["objectPosition"] })}>{["center", "top", "bottom", "left", "right"].map(option => <option key={option}>{option}</option>)}</select></label><label className="editor-span">Text alternativ<input value={value.alt} disabled={value.decorative} onChange={event => set({ alt: event.target.value })} /></label><label>Autor / fotograf<input value={value.author} onChange={event => set({ author: event.target.value })} /></label><label>Sursă<input type="url" value={value.sourceUrl} onChange={event => set({ sourceUrl: event.target.value })} /></label><label>Licență / permisiune<input value={value.license} onChange={event => set({ license: event.target.value })} /></label><label>Legendă<input value={value.caption} onChange={event => set({ caption: event.target.value })} /></label></div><div className="inline-actions"><button type="button" onClick={() => setSelector(true)}><ImageIcon />Alege sau încarcă din bibliotecă</button><label className="cms-toggle"><input type="checkbox" checked={value.decorative} onChange={event => set({ decorative: event.target.checked, alt: event.target.checked ? "" : value.alt })} />Imagine decorativă</label><label className="cms-toggle"><input type="checkbox" checked={value.showCredit} onChange={event => set({ showCredit: event.target.checked })} />Afișează creditul</label></div>{selector && <div className="cms-media-dialog" role="dialog" aria-modal="true" aria-label="Biblioteca media" ref={dialog}><div className="cms-media-panel"><header><div><p className="eyebrow">Biblioteca media</p><h2>Alege o imagine</h2></div><button type="button" aria-label="Închide" onClick={() => setSelector(false)}><X /></button></header><label>Caută în bibliotecă<input value={query} onChange={event => setQuery(event.target.value)} /></label><div className="cms-media-grid">{media.filter(item => `${item.title} ${item.original_filename} ${item.alt_text}`.toLowerCase().includes(query.toLowerCase())).map(item => <button type="button" key={item.id} disabled={item.approval_status !== "approved" || item.media_status !== "active"} onClick={() => { set({ mediaId: item.id, src: "", alt: item.alt_text || value.alt, author: item.photographer || value.author, sourceUrl: item.source_url || value.sourceUrl, license: item.license || value.license }); setSelector(false); }}><img src={`/api/media/${item.id}`} alt={item.alt_text || ""} width="240" height="160" /><span>{item.title || item.original_filename || `Imagine #${item.id}`}</span><small>{item.approval_status}</small></button>)}</div><div className="cms-media-upload"><h3>Încarcă o imagine nouă</h3><p>Se folosesc metadatele completate mai sus. Imaginea este aprobată de administrator și selectată automat.</p><input ref={fileInput} name="file" type="file" accept="image/jpeg,image/png,image/webp" /><button className="button" type="button" onClick={() => void upload()} disabled={uploading}>{uploading ? "Se încarcă…" : "Încarcă și selectează"}</button>{error && <p role="alert" className="error-message">{error}</p>}</div></div></div>}</fieldset>;
}

function move<T>(items: T[], from: number, to: number): T[] { const result = [...items]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function revisionLabel(action: string) { return action === "published" ? "Publicată" : action === "restored" ? "Restaurată" : action === "created" ? "Creată" : "Actualizată"; }
