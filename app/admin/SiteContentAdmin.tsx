"use client";

/* eslint-disable @next/next/no-img-element -- CMS previews use runtime D1/R2 media URLs. */

import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, EyeOff, History, Image as ImageIcon, Plus, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminSiteContentEntry } from "../server/site-content";
import type { CmsField, CmsImage, RichTextBlock } from "../site-content";
import { cmsImageUrl, resolveCmsImage } from "../site-content";
import { defaultTheme, themeContrastChecks, themeCssProperties } from "../theme";

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
  const fieldGroups = useMemo(() => groupFields(initial.fields), [initial.fields]);
  const themeChecks = initial.key === "theme.site" ? themeContrastChecks(content) : [];

  async function saveDraft() {
    setBusy("save"); setError(""); setMessage("");
    const response = await fetch(`/api/admin/site-content/${encodeURIComponent(initial.key)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, version }) });
    const data = await response.json() as { error?: string; version?: number; draft?: Record<string, unknown> };
    if (!response.ok) { setError(data.error || "Ciorna nu a putut fi salvată."); setBusy(""); return null; }
    const nextContent = data.draft ?? content;
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
    {message && <p className="success-message" role="status" aria-live="polite">{message}</p>}
    {initial.key === "theme.site" && <ThemeInspector content={content} checks={themeChecks} onReset={() => setContent({ ...defaultTheme })} />}
    <form className="cms-editor-form" onSubmit={event => { event.preventDefault(); void saveDraft(); }}>
      {fieldGroups.map(group => <fieldset className="cms-field-group" key={group.label}><legend>{group.label}</legend>{group.fields.map(field => <FieldEditor key={field.path} field={field} value={content[field.path]} publishedValue={initial.published[field.path]} onChange={next => setContent(current => ({ ...current, [field.path]: next }))} />)}</fieldset>)}
      <div className="cms-sticky-actions"><button className="button" disabled={Boolean(busy) || !dirty} type="submit"><Save />{busy === "save" ? "Se salvează…" : "Salvează ciorna"}</button><Link className="button button-outline" target="_blank" href={`/admin/previzualizare/${encodeURIComponent(initial.key)}`}><Eye />Previzualizează</Link><button className="button" disabled={Boolean(busy)} type="button" onClick={() => action("publish")}><Send />{busy === "publish" ? "Se publică…" : "Publică"}</button><button className="button button-outline" disabled={Boolean(busy) || (!initial.hasDraftChanges && !dirty)} type="button" onClick={() => action("discard")}><X />Renunță la ciornă</button></div>
    </form>
  </section><aside className="cms-history"><h2><History /> Istoric revizii</h2>{revisions.map(revision => <article key={revision.id}><strong>Revizia {revision.revision_number}</strong><span>{revisionLabel(revision.action)}</span><small>{revision.actor_name || "Sistem"} · {formatDate(revision.created_at)}</small><button type="button" onClick={() => action("restore", revision.id)} disabled={Boolean(busy)}><RotateCcw />Restaurează și publică</button></article>)}{!revisions.length && <p>Istoricul va apărea după prima salvare.</p>}</aside></div>;
}

function FieldEditor({ field, value, publishedValue, onChange }: { field: CmsField; value: unknown; publishedValue?: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === "hidden" || field.kind === "deletion-marker") return null;
  if (field.kind === "section-visibility") {
    const visible = value !== false;
    return <div className={`cms-section-visibility ${visible ? "is-visible" : "is-hidden"}`}><div><strong>{field.label}</strong><span>{visible ? "Secțiunea este afișată public când are conținut relevant." : "Conținutul rămâne salvat și poate fi afișat din nou."}</span></div><button type="button" aria-pressed={!visible} onClick={() => onChange(!visible)}>{visible ? <><EyeOff />Ascunde secțiunea</> : <><Eye />Afișează secțiunea</>}</button></div>;
  }
  if (field.kind === "toggle") return <label className="cms-toggle"><input type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  if (field.kind === "image") return <ImageField label={field.label} value={resolveCmsImage(value)} publishedValue={publishedValue} onChange={onChange} />;
  if (field.kind === "repeatable") return <RepeatableField field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />;
  if (field.kind === "richtext") return <RichTextField label={field.label} value={Array.isArray(value) ? value as RichTextBlock[] : []} onChange={onChange} />;
  if (field.kind === "color") return <div className="cms-field-control cms-color-control"><label>{field.label}<span className="cms-color-input"><input aria-label={`${field.label} — selector`} type="color" value={String(value || "#000000")} onChange={event => onChange(event.target.value)} /><input aria-label={`${field.label} — valoare HEX`} value={String(value ?? "")} pattern="#[0-9a-fA-F]{6}" onChange={event => onChange(event.target.value)} /></span></label>{String(value)!==String(publishedValue)&&<div className="cms-field-actions"><button type="button" onClick={()=>onChange(publishedValue)}><RotateCcw/>Revino la valoarea publicată</button></div>}</div>;
  if (field.kind === "font") return <div className="cms-field-control"><label>{field.label}<select value={String(value ?? "")} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option value={option} key={option}>{fontLabel(option)}</option>)}</select><span className="cms-font-sample" style={{fontFamily:fontFamily(String(value))}}>Blajul de azi — oameni, locuri și povești</span></label>{String(value)!==String(publishedValue)&&<div className="cms-field-actions"><button type="button" onClick={()=>onChange(publishedValue)}><RotateCcw/>Revino la valoarea publicată</button></div>}</div>;
  if (field.kind === "enum") return <div className="cms-field-control"><label>{field.label}<select value={String(value ?? "")} required={field.required} onChange={event => onChange(event.target.value)}>{!field.required && <option value="">— Fără valoare —</option>}{field.options?.map(option => <option key={option}>{option}</option>)}</select></label><ScalarActions value={value} publishedValue={publishedValue} onClear={() => onChange("")} onRestore={() => onChange(publishedValue)} /></div>;
  const common = { value: String(value ?? ""), required: field.required, maxLength: field.maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className="cms-field-control"><label>{field.label}{field.help && <small>{field.help}</small>}{field.kind === "multiline" ? <textarea {...common} rows={5} /> : <input {...common} type={field.kind === "external-url" ? "url" : "text"} />}</label><ScalarActions value={value} publishedValue={publishedValue} onClear={() => onChange("")} onRestore={() => onChange(publishedValue)} /></div>;
}

function ThemeInspector({content,checks,onReset}:{content:Record<string,unknown>;checks:ReturnType<typeof themeContrastChecks>;onReset:()=>void}) {
  const [viewport,setViewport]=useState<"mobile"|"tablet"|"desktop">("desktop");
  return <section className="theme-inspector"><header><div><h2>Previzualizare și contrast</h2><p>Schimbările sunt private până la publicare. Publicarea cere 4,5:1 pentru text și 3:1 pentru contururi, focus și indicatori de stare.</p></div><button type="button" className="button button-outline" onClick={onReset}><RotateCcw/>Revino la valorile implicite</button></header><div className="theme-viewport-controls" role="group" aria-label="Lățime previzualizare">{(["mobile","tablet","desktop"] as const).map(item=><button type="button" aria-pressed={viewport===item} onClick={()=>setViewport(item)} key={item}>{item==="mobile"?"Mobil":item==="tablet"?"Tabletă":"Desktop"}</button>)}</div><div className={`theme-sample theme-sample-${viewport}`} style={themeCssProperties(content) as React.CSSProperties}><div className="theme-sample-header"><strong>Blaj Azi</strong><span>Descoperă · Evenimente · Servicii</span><button>Adaugă</button></div><div className="theme-sample-body"><p className="eyebrow">Ghidul comunității</p><h2>Tot ce contează în Blaj</h2><p>Un exemplu de text principal și <span>text secundar</span>, afișat cu valorile ciornei.</p><button>Acțiune principală</button></div></div><div className="theme-contrast-grid">{checks.map(check=><article className={check.pass?"is-pass":"is-fail"} key={check.label}><span className="theme-contrast-swatch" style={{background:check.background,color:check.foreground}}>Aa</span><div><strong>{check.label}</strong><span>{check.ratio.toFixed(2)}:1 · prag {check.minimum}:1 · {check.pass?"Conform":"Sub prag"}</span></div></article>)}</div></section>;
}

function fontLabel(value:string){return value==="manrope"?"Manrope":value==="inter"?"Inter":value==="source-serif-4"?"Source Serif 4":value==="system-sans"?"Fontul sistemului":"Georgia"}
function fontFamily(value:string){return value==="manrope"?"var(--font-display), Manrope, sans-serif":value==="source-serif-4"?"Georgia, serif":value==="georgia"?"Georgia, serif":value==="system-sans"?"system-ui, sans-serif":"var(--font-sans), Inter, sans-serif"}

function ScalarActions({ value, publishedValue, onClear, onRestore }: { value: unknown; publishedValue: unknown; onClear: () => void; onRestore: () => void }) {
  const current = String(value ?? "");
  const published = String(publishedValue ?? "");
  if (!current && !published) return null;
  return <div className="cms-field-actions">{current && <button type="button" onClick={onClear}><X />Șterge conținutul</button>}{!current && published && <button type="button" onClick={onRestore}><RotateCcw />Restaurează valoarea publicată</button>}</div>;
}

function RepeatableField({ field, value, onChange }: { field: CmsField; value: unknown[]; onChange: (value: unknown[]) => void }) {
  const supportsRestore = Boolean(field.itemFields?.some(item => item.kind === "deletion-marker"));
  const supportsVisibility = Boolean(field.itemFields?.some(item => item.path === "visible"));
  function itemValue(item: unknown) { return typeof item === "string" ? { value: item } : item && typeof item === "object" ? item as Record<string, unknown> : {}; }
  function update(index: number, patch: Record<string, unknown>) { onChange(value.map((entry, itemIndex) => itemIndex === index ? { ...itemValue(entry), ...patch } : entry)); }
  function remove(index: number) {
    if (supportsRestore) update(index, { deleted: true, visible: false });
    else if (confirm("Ștergi definitiv acest element din ciornă?")) onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }
  return <fieldset className="cms-repeatable"><legend>{field.label}</legend>{value.map((rawItem, index) => {
    const item = itemValue(rawItem);
    const deleted = item.deleted === true;
    const visible = item.visible !== false;
    const itemName = String(item.label || item.value || `Element ${index + 1}`);
    return <article className={deleted ? "is-deleted" : visible ? "" : "is-hidden"} key={String(item.id || `${field.path}-${index}`)}><header><div><strong>{itemName}</strong>{deleted ? <span className="cms-item-state">Șters, disponibil pentru restaurare</span> : !visible && <span className="cms-item-state">Ascuns</span>}</div><div><button type="button" aria-label={`Mută mai sus: ${itemName}`} disabled={deleted || index === 0} onClick={() => onChange(move(value, index, index - 1))}><ArrowUp /></button><button type="button" aria-label={`Mută mai jos: ${itemName}`} disabled={deleted || index === value.length - 1} onClick={() => onChange(move(value, index, index + 1))}><ArrowDown /></button>{supportsVisibility && !deleted && <button type="button" aria-label={`${visible ? "Ascunde" : "Afișează"}: ${itemName}`} onClick={() => update(index, { visible: !visible })}>{visible ? <EyeOff /> : <Eye />}</button>}<button type="button" className={deleted ? "cms-restore-item" : "cms-delete-item"} aria-label={`${deleted ? "Restaurează" : "Șterge"}: ${itemName}`} onClick={() => deleted ? update(index, { deleted: false, visible: true }) : remove(index)}>{deleted ? <RotateCcw /> : <Trash2 />}</button></div></header>{!deleted && field.itemFields?.filter(itemField => !["id", "visible", "deleted"].includes(itemField.path)).map(itemField => <FieldEditor key={itemField.path} field={itemField.kind === "enum" && !itemField.options ? { ...itemField, options: field.options } : itemField} value={item[itemField.path]} onChange={next => update(index, { [itemField.path]: next })} />)}</article>;
  })}<button className="button button-outline" type="button" onClick={() => onChange([...value, newRepeatableItem(field)])}><Plus />Adaugă element</button></fieldset>;
}

function RichTextField({ label, value, onChange }: { label: string; value: RichTextBlock[]; onChange: (value: unknown) => void }) {
  const types = { paragraph: "Paragraf", heading2: "Titlu nivel 2", heading3: "Titlu nivel 3", "bulleted-list": "Listă cu marcatori", "numbered-list": "Listă numerotată", quote: "Citat", link: "Link" };
  return <fieldset className="cms-repeatable"><legend>{label}</legend>{value.map((block, index) => <article key={index}><header><strong>Bloc {index + 1}</strong><button type="button" aria-label="Elimină blocul" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></header><label>Tip<select value={block.type} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as RichTextBlock["type"] } : item))}>{Object.entries(types).map(([type, name]) => <option value={type} key={type}>{name}</option>)}</select></label><label>Text<textarea rows={4} value={block.text} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /></label>{block.type === "link" && <label>Link sigur<input value={block.href || ""} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))} /></label>}</article>)}<button className="button button-outline" type="button" onClick={() => onChange([...value, { type: "paragraph", text: "" }])}><Plus />Adaugă bloc</button></fieldset>;
}

function ImageField({ label, value, publishedValue, onChange }: { label: string; value: CmsImage; publishedValue?: unknown; onChange: (value: unknown) => void }) {
  const [selector, setSelector] = useState(false); const [media, setMedia] = useState<MediaItem[]>([]); const [query, setQuery] = useState(""); const [uploading, setUploading] = useState(false); const [error, setError] = useState(""); const dialog = useRef<HTMLDivElement>(null); const selectorTrigger = useRef<HTMLButtonElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!selector) return; void fetch("/api/media?scope=all").then(response => response.json()).then((data: { items?: MediaItem[] }) => setMedia(data.items || [])); }, [selector]);
  useEffect(() => {
    if (!selector || !dialog.current) return;
    const node = dialog.current;
    const triggerElement = selectorTrigger.current;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSelector(false); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    node.addEventListener("keydown", close); node.querySelector<HTMLElement>("button,input")?.focus();
    return () => { node.removeEventListener("keydown", close); triggerElement?.focus(); };
  }, [selector]);
  const set = (patch: Partial<CmsImage>) => onChange({ ...value, ...patch });
  const hasImage = Boolean(value.mediaId || value.src);
  const publishedImage = resolveCmsImage(publishedValue);
  const hasPublishedImage = Boolean(publishedImage.mediaId || publishedImage.src);
  async function upload() { const file = fileInput.current?.files?.[0]; if (!file) { setError("Alege o imagine înainte de încărcare."); return; } setUploading(true); setError(""); const form = new FormData(); form.set("file", file); for (const key of ["altText", "photographer", "sourceUrl", "license"]) form.set(key, key === "altText" ? value.alt : key === "photographer" ? value.author : key === "sourceUrl" ? value.sourceUrl : value.license); const response = await fetch("/api/media", { method: "POST", body: form }); const data = await response.json() as { id?: number; error?: string }; if (!response.ok || !data.id) { setError(data.error || "Imaginea nu a putut fi încărcată."); setUploading(false); return; } const approve = await fetch(`/api/media/${data.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", altText: value.alt, photographer: value.author, sourceUrl: value.sourceUrl, license: value.license }) }); if (!approve.ok) { setError("Imaginea a fost încărcată, dar nu a putut fi aprobată."); setUploading(false); return; } set({ mediaId: data.id, src: "" }); setUploading(false); setSelector(false); }
  return <fieldset className="cms-image-field"><legend>{label}</legend>{hasImage && <img src={cmsImageUrl(value)} alt={value.decorative ? "" : value.alt} style={{ objectPosition: value.objectPosition }} width="720" height="420" />}{hasImage && !value.decorative && !value.alt.trim() && <p className="cms-accessibility-warning" role="status">Avertizare de accesibilitate: imaginea semnificativă nu are text alternativ.</p>}<div className="editor-grid"><label>Cale imagine existentă<input value={value.src} placeholder="/images/exemplu.jpg" onChange={event => set({ src: event.target.value, mediaId: null })} /></label><label>Poziționare<select value={value.objectPosition} onChange={event => set({ objectPosition: event.target.value as CmsImage["objectPosition"] })}>{["center", "top", "bottom", "left", "right"].map(option => <option key={option}>{option}</option>)}</select></label><label className="editor-span">Text alternativ<input value={value.alt} disabled={value.decorative} onChange={event => set({ alt: event.target.value })} /></label><label>Autor / fotograf<input value={value.author} onChange={event => set({ author: event.target.value })} /></label><label>Sursă<input type="url" value={value.sourceUrl} onChange={event => set({ sourceUrl: event.target.value })} /></label><label>Licență / permisiune<input value={value.license} onChange={event => set({ license: event.target.value })} /></label><label>Legendă<input value={value.caption} onChange={event => set({ caption: event.target.value })} /></label></div><div className="inline-actions"><button ref={selectorTrigger} type="button" onClick={() => setSelector(true)}><ImageIcon />Alege sau încarcă din bibliotecă</button>{(hasImage || value.alt || value.author || value.sourceUrl || value.license || value.caption) && <button type="button" onClick={() => onChange({ ...resolveCmsImage(null), showCredit: false })}><Trash2 />Șterge imaginea și metadatele</button>}{!hasImage && hasPublishedImage && <button type="button" onClick={() => onChange(publishedImage)}><RotateCcw />Restaurează imaginea publicată</button>}<label className="cms-toggle"><input type="checkbox" checked={value.decorative} onChange={event => set({ decorative: event.target.checked, alt: event.target.checked ? "" : value.alt })} />Imagine decorativă</label><label className="cms-toggle"><input type="checkbox" checked={value.showCredit} onChange={event => set({ showCredit: event.target.checked })} />Afișează creditul</label></div>{selector && <div className="cms-media-dialog" role="dialog" aria-modal="true" aria-label="Biblioteca media" ref={dialog}><div className="cms-media-panel"><header><div><p className="eyebrow">Biblioteca media</p><h2>Alege o imagine</h2></div><button type="button" aria-label="Închide" onClick={() => setSelector(false)}><X /></button></header><label>Caută în bibliotecă<input value={query} onChange={event => setQuery(event.target.value)} /></label><div className="cms-media-grid">{media.filter(item => `${item.title} ${item.original_filename} ${item.alt_text}`.toLowerCase().includes(query.toLowerCase())).map(item => <button type="button" key={item.id} disabled={item.approval_status !== "approved" || item.media_status !== "active"} onClick={() => { set({ mediaId: item.id, src: "", alt: item.alt_text ?? value.alt, author: item.photographer ?? value.author, sourceUrl: item.source_url ?? value.sourceUrl, license: item.license ?? value.license }); setSelector(false); }}><img src={`/api/media/${item.id}`} alt={item.alt_text || ""} width="240" height="160" /><span>{item.title || item.original_filename || `Imagine #${item.id}`}</span><small>{item.approval_status}</small></button>)}</div><div className="cms-media-upload"><h3>Încarcă o imagine nouă</h3><p>Se folosesc metadatele completate mai sus. Imaginea este aprobată de administrator și selectată automat.</p><input ref={fileInput} name="file" type="file" accept="image/jpeg,image/png,image/webp" /><button className="button" type="button" onClick={() => void upload()} disabled={uploading}>{uploading ? "Se încarcă…" : "Încarcă și selectează"}</button>{error && <p role="alert" className="error-message">{error}</p>}</div></div></div>}</fieldset>;
}

function groupFields(fields: readonly CmsField[]) {
  const groups = new Map<string, CmsField[]>();
  for (const field of fields) { const label = field.group || "Conținut"; groups.set(label, [...(groups.get(label) || []), field]); }
  return Array.from(groups, ([label, groupedFields]) => ({ label, fields: groupedFields }));
}

function newRepeatableItem(field: CmsField) {
  return Object.fromEntries((field.itemFields || []).map(item => [item.path, item.kind === "hidden" && item.path === "id" ? crypto.randomUUID() : item.kind === "toggle" || item.kind === "section-visibility" || item.kind === "deletion-marker" ? item.defaultValue === true : item.kind === "repeatable" || item.kind === "richtext" ? [] : item.kind === "image" ? resolveCmsImage(null) : item.defaultValue ?? ""]));
}

function move<T>(items: T[], from: number, to: number): T[] { const result = [...items]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function revisionLabel(action: string) { return action === "published" ? "Publicată" : action === "restored" ? "Restaurată" : action === "created" ? "Creată" : "Actualizată"; }
