"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Check, Copy, Eye, RotateCcw, Save, Send, Trash2, Upload, X } from "lucide-react";

export const statusLabels: Record<string, string> = {
  draft: "Ciornă", pending_review: "În verificare", needs_changes: "Necesită modificări", approved: "Aprobat",
  scheduled: "Programat", published: "Publicat", rejected: "Respins", expired: "Expirat", archived: "Arhivat", soft_deleted: "Șters",
};

export const typeLabels: Record<string, string> = {
  business: "Afacere", community_post: "Postare comunitară", local_story: "Poveste locală", article: "Articol editorial",
  business_update: "Actualizare de afacere", event: "Eveniment", offer: "Ofertă", job: "Job", restaurant: "Restaurant",
  daily_menu: "Meniul zilei", place: "Loc de descoperit",
};

type ContentItem = { id: number; type: string; title: string; excerpt: string | null; status: string; moderation_state: string; updated_at: string; version: number; business_id: number | null; body?:string;locality?:string;sourceUrl?:string;details?:Record<string,unknown> };
type BusinessOption = { id: number; name: string };

export function ContentList({ items }: { items: ContentItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("updated");
  const filtered = useMemo(() => items.filter(item => (!status || item.status === status) && (!type || item.type === type) && item.title.toLocaleLowerCase("ro-RO").includes(query.toLocaleLowerCase("ro-RO"))).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"ro-RO"):String(b.updated_at).localeCompare(String(a.updated_at))), [items, query, status, type,sort]);
  return <div>
    <div className="management-toolbar"><input aria-label="Caută în conținut" placeholder="Caută după titlu" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Filtrează după tip" value={type} onChange={event => setType(event.target.value)}><option value="">Toate tipurile</option>{Object.entries(typeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrează după stare" value={status} onChange={event => setStatus(event.target.value)}><option value="">Toate stările</option>{Object.entries(statusLabels).filter(([value]) => value !== "soft_deleted").map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Sortează conținutul" value={sort} onChange={event=>setSort(event.target.value)}><option value="updated">Actualizate recent</option><option value="title">Titlu A–Z</option></select><Link className="button" href="/cont/continut/nou">Creează</Link></div>
    <div className="management-list">{filtered.map(item => <article className="management-row" key={item.id}><div><span className={`status-pill status-${item.status}`}>{statusLabels[item.status] || item.status}</span><small>{typeLabels[item.type] || item.type}</small><h3>{item.title}</h3><p>{item.excerpt || "Fără rezumat"}</p><time>Salvat {formatDate(item.updated_at)}</time></div><div className="management-actions"><Link href={`/cont/continut/${item.id}`}><Eye /> Deschide</Link><ContentAction id={item.id} action="duplicate" label="Duplică" icon="copy" />{item.status === "published" && <ContentAction id={item.id} action="archive" label="Arhivează" icon="archive" />}{item.status === "archived" && <ContentAction id={item.id} action="restore" label="Restaurează" icon="restore" />}</div></article>)}</div>
    {filtered.length === 0 && <div className="management-empty"><h3>Nu există rezultate</h3><p>Schimbă filtrele sau creează o ciornă nouă.</p></div>}
  </div>;
}

export function ContentEditor({ initial, businesses }: { initial?: ContentItem; businesses: BusinessOption[] }) {
  const [type, setType] = useState(initial?.type || "community_post");
  const [state, setState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(initial);
  const [preview, setPreview] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("saving"); setMessage("");
    const form = new FormData(event.currentTarget);
    const media = form.get("media");
    const details: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) if (key.startsWith("detail.")) details[key.slice(7)] = value;
    const payload = { type, title: form.get("title"), excerpt: form.get("excerpt"), body: form.get("body"), locality: form.get("locality"), businessId: form.get("businessId") ? Number(form.get("businessId")) : null, sourceUrl: form.get("sourceUrl"), version: saved?.version, details };
    const response = await fetch(saved ? `/api/account/content/${saved.id}` : "/api/account/content", { method: saved ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as ContentItem & { error?: string };
    if (!response.ok) { setState("error"); setMessage(data.error || "Ciorna nu a putut fi salvată."); return; }
    setSaved({ ...(saved || { type, title: String(form.get("title")), excerpt: String(form.get("excerpt")), status: "draft", moderation_state: "draft", updated_at: new Date().toISOString(), business_id: payload.businessId }), ...data } as ContentItem);
    setState("saved"); setMessage("Ciorna a fost salvată.");
    if(media instanceof File&&media.size){const upload=new FormData();upload.set("file",media);upload.set("altText",String(form.get("altText")||""));upload.set("title",String(form.get("title")||""));upload.set("contentId",String(saved?.id||data.id));if(payload.businessId)upload.set("businessId",String(payload.businessId));const mediaResponse=await fetch("/api/media",{method:"POST",body:upload});if(!mediaResponse.ok){const mediaData=await mediaResponse.json() as{error?:string};setState("error");setMessage(`Ciorna a fost salvată, dar imaginea nu: ${mediaData.error||"eroare necunoscută"}`)}}
    if (!initial && data.id) history.replaceState(null, "", `/cont/continut/${data.id}`);
  }
  const locked = saved?.status === "pending_review" || saved?.status === "soft_deleted";
  return <>
    <form className="content-editor" onSubmit={save}>
      <div className="editor-status"><span className={`status-pill status-${saved?.status || "draft"}`}>{statusLabels[saved?.status || "draft"]}</span><span>{saved ? `Versiunea ${saved.version}` : "Ciornă nouă"}</span>{message && <strong className={state === "error" ? "error-message" : "success-message"} role="status">{message}</strong>}</div>
      {saved?.status === "pending_review" && <div className="moderation-note"><strong>Materialul este în verificare.</strong><span>Retrage trimiterea înainte de a-l modifica.</span></div>}
      {saved?.status === "soft_deleted" && <div className="moderation-note"><strong>Materialul este șters recuperabil.</strong><span>Un administrator trebuie să îl recupereze înainte de editare.</span></div>}
      <fieldset disabled={locked || state === "saving"}><legend>Tipul materialului</legend><select name="type" value={type} onChange={event => setType(event.target.value)} disabled={Boolean(saved)}>{Object.entries(typeLabels).filter(([value]) => value !== "article" || businesses.length > 0).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></fieldset>
      {businesses.length > 0 && <label>Afacerea asociată<select name="businessId" defaultValue={initial?.business_id || ""}><option value="">Fără afacere</option>{businesses.map(business => <option value={business.id} key={business.id}>{business.name}</option>)}</select></label>}
      <label>Titlu<input name="title" required maxLength={240} defaultValue={initial?.title || ""} disabled={locked} /></label>
      <div className="editor-grid"><label>Localitate<input name="locality" required maxLength={120} defaultValue={initial?.locality||"Blaj"} disabled={locked} /></label><label>Sursă oficială sau de verificare<input name="sourceUrl" type="url" maxLength={800} defaultValue={initial?.sourceUrl||""} disabled={locked} /></label></div>
      <label>Rezumat<textarea name="excerpt" required maxLength={600} rows={3} defaultValue={initial?.excerpt || ""} disabled={locked} /></label>
      {(["community_post","local_story","article","business_update"].includes(type)) && <label>Conținut<textarea name="body" required maxLength={30000} rows={12} defaultValue={initial?.body||""} disabled={locked} /></label>}
      <TypeFields type={type} locked={locked} details={initial?.details||{}} />
      <label className="media-upload"><Upload /><span>Încarcă o fotografie în biblioteca media. Ea devine publică numai după aprobare.</span><input name="media" type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} /><span>Alt text pentru imagine</span><input name="altText" maxLength={500} disabled={locked}/></label>
      <div className="editor-buttons"><button className="button" type="submit" disabled={locked || state === "saving"}><Save /> {state === "saving" ? "Se salvează…" : "Salvează ciorna"}</button><button className="button button-outline" type="button" onClick={() => setPreview(value => !value)}><Eye /> Previzualizează</button>{saved && <ContentAction id={saved.id} action={saved.status === "pending_review" ? "withdraw" : "submit"} label={saved.status === "pending_review" ? "Retrage trimiterea" : "Trimite spre verificare"} icon={saved.status === "pending_review" ? "x" : "send"} />}{saved && ["draft","needs_changes","rejected"].includes(saved.status) && <ContentAction id={saved.id} action="delete" label="Șterge ciorna" icon="trash" danger />}</div>
    </form>
    {preview && <aside className="editor-preview" aria-live="polite"><span>Previzualizare privată</span><h2>{saved?.title || "Titlul materialului"}</h2><p>{saved?.excerpt || "Rezumatul va apărea aici după salvare."}</p><small>Previzualizarea nu este publică.</small></aside>}
  </>;
}

function TypeFields({ type, locked,details }: { type: string; locked: boolean;details:Record<string,unknown> }) {
  const value=(camel:string,snake=camel)=>String(details[camel]??details[snake]??"");
  if (type === "event") return <div className="editor-grid"><label>Organizator<input name="detail.organizer" required defaultValue={value("organizer")} disabled={locked} /></label><label>Locul evenimentului<input name="detail.venue" required defaultValue={value("venue")} disabled={locked} /></label><label>Începe la<input name="detail.startsAt" type="datetime-local" required defaultValue={value("startsAt","starts_at").slice(0,16)} disabled={locked} /></label><label>Se încheie la<input name="detail.endsAt" type="datetime-local" defaultValue={value("endsAt","ends_at").slice(0,16)} disabled={locked} /></label><label>Adresă<input name="detail.address" defaultValue={value("address")} disabled={locked} /></label><label>Informații bilete<input name="detail.ticketInfo" defaultValue={value("ticketInfo","ticket_info")} disabled={locked} /></label></div>;
  if (type === "offer") return <div className="editor-grid"><label>Începe la<input name="detail.startsAt" type="date" required defaultValue={value("startsAt","starts_at").slice(0,10)} disabled={locked} /></label><label>Se încheie la<input name="detail.endsAt" type="date" required defaultValue={value("endsAt","ends_at").slice(0,10)} disabled={locked} /></label><label>Preț promoțional<input name="detail.price" type="number" min="0" step="0.01" defaultValue={value("price")} disabled={locked} /></label><label>Preț inițial<input name="detail.oldPrice" type="number" min="0" step="0.01" defaultValue={value("oldPrice","old_price")} disabled={locked} /></label><label className="editor-span">Condiții<textarea name="detail.terms" rows={4} defaultValue={value("terms")} disabled={locked} /></label></div>;
  if (type === "job") return <div className="editor-grid"><label>Companie<input name="detail.company" required defaultValue={value("company")} disabled={locked} /></label><label>Tip contract<input name="detail.contractType" defaultValue={value("contractType","contract_type")} disabled={locked} /></label><label>Program<input name="detail.schedule" defaultValue={value("schedule")} disabled={locked} /></label><label>Mod de lucru<input name="detail.workArrangement" defaultValue={value("workArrangement","work_arrangement")} disabled={locked} /></label><label>Salariu minim<input name="detail.salaryMin" type="number" min="0" defaultValue={value("salaryMin","salary_min")} disabled={locked} /></label><label>Salariu maxim<input name="detail.salaryMax" type="number" min="0" defaultValue={value("salaryMax","salary_max")} disabled={locked} /></label><label className="editor-span">Responsabilități<textarea name="detail.responsibilities" rows={5} defaultValue={value("responsibilities")} disabled={locked} /></label><label className="editor-span">Cerințe<textarea name="detail.requirements" rows={5} defaultValue={value("requirements")} disabled={locked} /></label><label>Termen limită<input name="detail.deadline" type="date" defaultValue={value("deadline").slice(0,10)} disabled={locked} /></label><label>Link de aplicare<input name="detail.applyUrl" type="url" defaultValue={value("applyUrl","apply_url")} disabled={locked} /></label></div>;
  if (type === "business") return <div className="editor-grid"><label>Adresă<input name="detail.address" required defaultValue={value("address")} disabled={locked} /></label><label>Telefon<input name="detail.phone" defaultValue={value("phone")} disabled={locked} /></label><label>Website<input name="detail.website" type="url" defaultValue={value("website")} disabled={locked} /></label></div>;
  if (type === "restaurant") return <div className="editor-grid"><label>Specific<input name="detail.cuisine" defaultValue={value("cuisine")} disabled={locked} /></label><label><input name="detail.delivery" type="checkbox" defaultChecked={Boolean(details.delivery)} disabled={locked} /> Livrare</label><label><input name="detail.pickup" type="checkbox" defaultChecked={Boolean(details.pickup)} disabled={locked} /> Ridicare</label></div>;
  if (type === "daily_menu") return <div className="editor-grid"><label>Data meniului<input name="detail.menuDate" type="date" required defaultValue={value("menuDate","menu_date").slice(0,10)} disabled={locked} /></label><label>Restaurant ID<input name="detail.restaurantId" type="number" required defaultValue={value("restaurantId","restaurant_id")} disabled={locked} /></label><label>Supă / ciorbă<input name="detail.soup" defaultValue={value("soup")} disabled={locked} /></label><label>Fel principal<input name="detail.mainDish" defaultValue={value("mainDish","main_dish")} disabled={locked} /></label><label>Garnitură<input name="detail.sideDish" defaultValue={value("sideDish","side_dish")} disabled={locked} /></label><label>Desert<input name="detail.dessert" defaultValue={value("dessert")} disabled={locked} /></label><label>Preț<input name="detail.price" type="number" min="0" step="0.01" defaultValue={value("price")} disabled={locked} /></label></div>;
  return null;
}

export function ContentAction({ id, action, label, icon, danger = false }: { id: number; action: string; label: string; icon: string; danger?: boolean }) {
  const [busy, setBusy] = useState(false);
  const Icon = icon === "copy" ? Copy : icon === "archive" ? Archive : icon === "restore" ? RotateCcw : icon === "trash" ? Trash2 : icon === "x" ? X : Send;
  async function run() {
    if (["archive","withdraw","delete"].includes(action) && !window.confirm(`Confirmi acțiunea „${label}”?`)) return;
    setBusy(true);
    const response = await fetch(`/api/account/content/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) window.alert(data.error || "Acțiunea nu a putut fi finalizată."); else location.reload();
    setBusy(false);
  }
  return <button className={danger ? "danger-action" : ""} type="button" onClick={run} disabled={busy}><Icon /> {busy ? "Se procesează…" : label}</button>;
}

export function BusinessRegistrationForm() {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form); const response = await fetch("/api/account/businesses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json() as { error?: string }; setMessage(response.ok ? "Afacerea a fost trimisă spre verificare." : data.error || "Cererea nu a putut fi trimisă."); if (response.ok) event.currentTarget.reset(); }
  return <form className="content-editor" onSubmit={submit}><label>Numele afacerii<input name="name" required /></label><div className="editor-grid"><label>Localitate<input name="locality" required defaultValue="Blaj" /></label><label>Adresă<input name="address" required /></label><label>Telefon<input name="phone" /></label><label>Website<input name="website" type="url" /></label></div><label>Descriere<textarea name="description" required rows={6} /></label><label>De ce reprezinți această afacere?<textarea name="explanation" required rows={5} /></label><label>Dovadă sau sursă de verificare<input name="evidenceUrl" type="url" /></label><label>Date de contact pentru verificare<textarea name="contactInformation" required rows={3} /></label><label className="consent"><input type="checkbox" required /> Confirm că informațiile sunt corecte și am dreptul să reprezint afacerea.</label><button className="button" type="submit">Trimite spre verificare</button>{message && <p role="status">{message}</p>}</form>;
}

export function ClaimBusinessForm({ businesses }: { businesses: BusinessOption[] }) {
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/account/claims", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await response.json() as { error?: string }; setMessage(response.ok ? "Revendicarea a fost trimisă spre verificare." : data.error || "Cererea nu a putut fi trimisă."); }
  return <form className="content-editor" onSubmit={submit}><label>Afacerea<select name="businessId" required><option value="">Selectează</option>{businesses.map(business => <option value={business.id} key={business.id}>{business.name}</option>)}</select></label><label>Explică relația cu afacerea<textarea name="explanation" required rows={6} /></label><label>Dovadă sau document public<input name="evidenceUrl" type="url" /></label><label>Date de contact pentru verificare<textarea name="contactInformation" required rows={3} /></label><button className="button" type="submit">Trimite revendicarea</button>{message && <p role="status">{message}</p>}</form>;
}

export function InvitationAction({ membershipId }: { membershipId: number }) {
  const [busy, setBusy] = useState(false);
  async function run(action: "accept_invitation"|"decline_invitation") { setBusy(true); await fetch("/api/account/claims", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, membershipId }) }); location.reload(); }
  return <div className="inline-actions"><button className="button button-small" disabled={busy} onClick={() => run("accept_invitation")}><Check /> Acceptă</button><button className="button button-outline" disabled={busy} onClick={() => run("decline_invitation")}><X /> Refuză</button></div>;
}

export function NotificationActions() { const [busy,setBusy] = useState(false); return <button className="button button-outline" disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/account/notifications", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ action:"read_all" }) }); location.reload(); }}>Marchează toate ca citite</button>; }

const weekdayLabels=["Luni","Marți","Miercuri","Joi","Vineri","Sâmbătă","Duminică"];
export function BusinessHoursManager({businessId,items}:{businessId:number;items:Array<{weekday:number;opens_at:string|null;closes_at:string|null;closed:number}>}){
  const initial=weekdayLabels.map((_,weekday)=>{const row=items.find(item=>item.weekday===weekday);return{weekday,opensAt:row?.opens_at||"09:00",closesAt:row?.closes_at||"17:00",closed:Boolean(row?.closed)}});
  const[hours,setHours]=useState(initial);const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);
  async function save(){setBusy(true);const response=await fetch(`/api/businesses/${businessId}/hours`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({hours})});const data=await response.json() as{error?:string};setMessage(response.ok?"Programul a fost salvat.":data.error||"Programul nu a putut fi salvat.");setBusy(false)}
  return <section className="account-panel hours-editor"><h2>Program săptămânal</h2>{hours.map((row,index)=><div className="hours-row" key={row.weekday}><strong>{weekdayLabels[index]}</strong><label><span>Deschide</span><input type="time" value={row.opensAt} disabled={row.closed} onChange={event=>setHours(current=>current.map(item=>item.weekday===row.weekday?{...item,opensAt:event.target.value}:item))}/></label><label><span>Închide</span><input type="time" value={row.closesAt} disabled={row.closed} onChange={event=>setHours(current=>current.map(item=>item.weekday===row.weekday?{...item,closesAt:event.target.value}:item))}/></label><label className="consent"><input type="checkbox" checked={row.closed} onChange={event=>setHours(current=>current.map(item=>item.weekday===row.weekday?{...item,closed:event.target.checked}:item))}/> Închis</label></div>)}<button className="button" onClick={save} disabled={busy}>{busy?"Se salvează…":"Salvează programul"}</button>{message&&<p role="status">{message}</p>}</section>
}

export function BusinessMediaManager({businessId,contentId,items}:{businessId:number;contentId?:number;items:Array<{id:number;title:string|null;original_filename:string|null;alt_text:string|null;approval_status:string;media_status:string}>}){
  const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);
  async function upload(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const form=new FormData(event.currentTarget);form.set("businessId",String(businessId));if(contentId)form.set("contentId",String(contentId));const response=await fetch("/api/media",{method:"POST",body:form});const data=await response.json() as{error?:string};if(response.ok)location.reload();else setMessage(data.error||"Imaginea nu a putut fi încărcată.");setBusy(false)}
  async function archive(id:number){if(!confirm("Arhivezi această imagine?"))return;const response=await fetch(`/api/media/${id}`,{method:"DELETE"});if(response.ok)location.reload();else{const data=await response.json() as{error?:string};setMessage(data.error||"Imaginea nu a putut fi arhivată.")}}
  return <><form className="content-editor media-manager" onSubmit={upload}><h2>Adaugă fotografie</h2><label>Imagine<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></label><label>Alt text<input name="altText" required maxLength={500}/></label><div className="editor-grid"><label>Titlu<input name="title" maxLength={240}/></label><label>Fotograf<input name="photographer" maxLength={240}/></label><label>Sursă<input name="sourceUrl" type="url" maxLength={800}/></label><label>Licență<input name="license" maxLength={120}/></label></div><button className="button" disabled={busy}>{busy?"Se încarcă…":"Încarcă fotografia"}</button>{message&&<p role="alert">{message}</p>}</form><div className="media-grid">{items.map(item=><article className="media-card" key={item.id}><img src={`/api/media/${item.id}`} alt={item.alt_text||""} width="640" height="480" loading="lazy"/><span className="status-pill">{item.approval_status}</span><h3>{item.title||item.original_filename||`Imagine #${item.id}`}</h3><button className="danger-action" onClick={()=>archive(item.id)}>Arhivează</button></article>)}</div></>
}

export function TeamManager({ businessId, items }: { businessId: number; items: Array<{ id:number; display_name?:string; email?:string; invite_email?:string; membership_role:string; membership_status:string }> }) {
  const [message,setMessage] = useState("");
  async function invite(event:React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form=new FormData(event.currentTarget); const response=await fetch(`/api/businesses/${businessId}/team`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(form))}); const data=await response.json() as {error?:string}; setMessage(response.ok?"Invitația a fost creată.":data.error||"Invitația nu a putut fi creată."); if(response.ok) location.reload(); }
  return <><form className="team-invite" onSubmit={invite}><label>E-mail manager<input name="email" type="email" required /></label><button className="button" type="submit">Invită manager</button></form>{message&&<p role="status">{message}</p>}<div className="management-list">{items.map(item=><article className="management-row" key={item.id}><div><span className={`status-pill status-${item.membership_status}`}>{item.membership_status === "active" ? "Activ" : "Invitat"}</span><h3>{item.display_name||item.email||item.invite_email}</h3><p>{item.membership_role === "owner" ? "Proprietar" : "Manager"}</p></div>{item.membership_role !== "owner"&&<button className="danger-action" onClick={async()=>{if(confirm("Retragi accesul acestui manager?")){await fetch(`/api/businesses/${businessId}/team?membershipId=${item.id}`,{method:"DELETE"});location.reload();}}}><Trash2 /> Retrage accesul</button>}</article>)}</div></>;
}

function formatDate(value:string){ try { return new Intl.DateTimeFormat("ro-RO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); } catch { return value; } }
