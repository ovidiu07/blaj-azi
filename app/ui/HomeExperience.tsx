"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Clock3, MapPin, Search, Store, Tag, UtensilsCrossed } from "lucide-react";
import type { PublicCatalog } from "../public-types";
import { useMemo, useState } from "react";

const categories = [
  ["/evenimente", "Evenimente", CalendarDays], ["/unde-mancam", "Restaurante", UtensilsCrossed], ["/afaceri-si-servicii", "Servicii", Store],
  ["/oferte-locale", "Oferte", Tag], ["/locuri-de-munca", "Joburi", BriefcaseBusiness], ["/evenimente?categorie=copii", "Pentru copii", Check],
] as const;

export function HomeExperience({ catalog }: { catalog: PublicCatalog }) {
  const { businesses, events, jobs, offers, places, restaurants } = catalog;
  const [eventFilter, setEventFilter] = useState("Toate");
  const [foodFilter, setFoodFilter] = useState("Toate");
  const shownEvents = useMemo(() => eventFilter === "Toate" ? events : events.filter(e => e.category === eventFilter || eventFilter === "Weekend"), [eventFilter,events]);
  const shownFood = useMemo(() => foodFilter === "Toate" ? restaurants : restaurants.filter(r => r.type.includes(foodFilter) || r.services.includes(foodFilter)), [foodFilter,restaurants]);
  const featuredPlace = places[1] || places[0];
  const today = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return <>
    <section className="hero">
      <img className="hero-image" src="/images/campia-libertatii.jpg" alt="Câmpia Libertății din Blaj" width="1600" height="1067" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-content"><p className="kicker">Ghidul comunității din Blaj</p><h1>Tot ce contează în Blaj,<br /><em>într-un singur loc.</em></h1><p className="hero-copy">Descoperă oameni, locuri și lucruri utile — aproape de tine, explicate simplu și actualizate responsabil.</p><form className="hero-search" action="/cauta" method="get"><Search aria-hidden="true" /><label className="sr-only" htmlFor="hero-query">Caută în Blaj</label><input id="hero-query" name="q" placeholder="Ce cauți în Blaj?" /><button type="submit">Caută</button></form><div className="hero-actions"><Link className="button" href="/evenimente?period=today">Ce se întâmplă azi <ArrowRight size={18} /></Link><Link className="text-link light" href="/adauga">Adaugă informație <ChevronRight size={16} /></Link></div><p className="image-credit">Foto: Țetcu Mircea Rareș · Wikimedia Commons · CC BY-SA 4.0</p></div>
    </section>

    <section className="category-strip" aria-label="Categorii rapide"><div className="container category-grid">{categories.map(([href, label, Icon]) => <Link href={href} key={label}><Icon size={20} /><span>{label}</span><ChevronRight size={16} /></Link>)}</div></section>

    <section className="section container"><SectionHead eyebrow="În următoarele zile" title="Ce se întâmplă în Blaj" href="/evenimente" link="Vezi calendarul" />{events.length>0&&<div className="chips" role="group" aria-label="Filtre evenimente">{["Toate", "Weekend", "Copii", "Cultură", "Comunitate"].map(f => <button onClick={() => setEventFilter(f)} className={eventFilter === f ? "active" : ""} key={f}>{f}</button>)}</div>}<div className="event-grid">{shownEvents.slice(0,3).map((event, i) => <article className={`event-card ${i === 0 ? "event-featured" : ""}`} key={event.id}><div className="event-image"><img src={event.image} alt="" width="640" height="420" loading="lazy" />{event.isDemo && <span className="demo-badge">Conținut demonstrativ</span>}</div><div className="event-body"><div className="meta"><span>{event.category}</span><span>{event.price}</span></div><h3>{event.title}</h3><p><CalendarDays size={17} /> {event.date} · {event.time}</p><p><MapPin size={17} /> {event.place}</p><Link className="card-link" href={`/evenimente/${event.id}`}>Detalii <ArrowRight size={16} /></Link></div></article>)}</div>{shownEvents.length === 0 && <EmptyState />}</section>

    {featuredPlace&&<section className="discover-section"><div className="container"><SectionHead eyebrow="Orașul nostru" title="Descoperă Blaj" href="/descopera-blaj" link="Explorează toate locurile" light /><div className="editorial-grid"><article className="story-main"><img src={featuredPlace.image} alt="" width="900" height="600" loading="lazy" /><div><p className="kicker">Povestea orașului</p><h3>Un loc în care istoria rămâne vie</h3><p>Reperele Blajului, poveștile oamenilor și locurile care merită privite pe îndelete.</p><Link className="button button-cream" href="/descopera-blaj">Începe explorarea</Link></div></article><div className="story-list">{places.slice(0, 3).map(place => <Link href={`/descopera-blaj/${place.id}`} className="story-row" key={place.id}><img src={place.image} alt="" width="232" height="176" loading="lazy" /><span><small>{place.eyebrow}</small><strong>{place.title}</strong></span><ArrowRight /></Link>)}</div></div><div className="media-links"><Link href="/descopera-blaj#imagini">Vezi Blajul în imagini <ArrowRight /></Link></div></div></section>}

    {businesses.length>0&&<section className="section container"><SectionHead eyebrow="Aproape de tine" title="Servicii locale recomandate" href="/afaceri-si-servicii" link="Vezi toate serviciile" /><div className="business-grid">{businesses.slice(0,4).map(b => <article className="business-card" key={b.id}>{b.promoted && <span className="promoted">Promovat</span>}<div className="business-mark">{b.name.charAt(0)}</div><p className="eyebrow">{b.category}</p><h3>{b.name}</h3><p><MapPin size={16} /> {b.locality}</p>{b.isDemo && <span className="demo-line">Exemplu demonstrativ</span>}<div className="card-actions"><Link href={`/afaceri-si-servicii/${b.id}`}>Vezi profilul <ArrowRight size={17}/></Link></div></article>)}</div></section>}

    {offers.length>0&&<section className="section offer-section"><div className="container"><SectionHead eyebrow="Merită văzut" title="Oferte în Blaj" href="/oferte-locale" link="Toate ofertele" /><div className="offer-grid">{offers.slice(0,3).map((o, i) => <article className="offer-card" key={o.id}><span className="offer-number">0{i + 1}</span>{o.isDemo&&<p className="demo-line">Exemplu demonstrativ</p>}<h3>{o.title}</h3><p>{o.business}</p><div className="price">{o.old&&<del>{o.old}</del>}<strong>{o.price}</strong></div><p className="offer-until"><Clock3 size={16} /> Valabilă până la {o.until}</p><Link href={`/oferte-locale/${o.id}`}>Vezi condițiile <ArrowRight size={16} /></Link></article>)}</div></div></section>}

    {restaurants.length>0&&<section className="section container"><SectionHead eyebrow={`Astăzi, ${today}`} title="Unde mâncăm astăzi?" href="/unde-mancam" link="Vezi toate localurile" /><div className="chips">{["Toate", "Meniul zilei", "Livrare", "Ridicare", "Cafenea"].map(f => <button onClick={() => setFoodFilter(f)} className={foodFilter === f ? "active" : ""} key={f}>{f}</button>)}</div><div className="food-list">{shownFood.slice(0,5).map((r, i) => <article className="food-card" key={r.id}><div className="food-index">{String(i + 1).padStart(2, "0")}</div><div><p className="eyebrow">{r.type}{r.isDemo?" · Exemplu demonstrativ":""}</p><h3>{r.name}</h3><p>{r.dish}</p><small>{r.services}</small></div><strong>{r.price}</strong><Link href={`/unde-mancam/${r.id}`} aria-label={`Detalii ${r.name}`}><ArrowRight /></Link></article>)}</div></section>}

    {jobs.length>0&&<section className="section jobs-section"><div className="container"><SectionHead eyebrow="Oportunități locale" title="Locuri de muncă în apropiere" href="/locuri-de-munca" link="Vezi toate joburile" light /><div className="job-list">{jobs.slice(0,4).map(job => <article className="job-row" key={job.id}><div>{job.isDemo&&<span className="demo-badge">Exemplu demonstrativ</span>}<h3>{job.title}</h3><p>{job.company} · {job.locality}</p></div><div><small>Program</small><strong>{job.type} · {job.schedule}</strong></div><div><small>Salariu</small><strong>{job.salary}</strong></div><Link href={`/locuri-de-munca/${job.id}`}>Detalii <ArrowRight size={16} /></Link></article>)}</div></div></section>}

    <section className="business-cta"><div className="container"><div><p className="kicker">Pentru comunitatea locală</p><h2>Ai o informație utilă?</h2><p>Adaugă o afacere, ofertă, slujbă, poveste sau un eveniment. Fiecare trimitere este verificată înainte de publicare.</p></div><div><Link className="button button-cream" href="/adauga">Alege ce vrei să adaugi</Link></div></div></section>
  </>;
}

function SectionHead({ eyebrow, title, href, link, light = false }: { eyebrow: string; title: string; href: string; link: string; light?: boolean }) { return <div className={`section-head ${light ? "light" : ""}`}><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="text-link" href={href}>{link} <ArrowRight size={17} /></Link></div>; }
function EmptyState() { return <div className="empty-state"><Search /><h3>Niciun rezultat aici, deocamdată.</h3><p>Încearcă un alt filtru sau vezi toate evenimentele.</p></div>; }
