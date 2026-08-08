"use client";

import Link from "next/link";
import { Menu, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

const mainNav = [
  ["/descopera-blaj", "Descoperă Blaj"], ["/evenimente", "Evenimente"], ["/afaceri-si-servicii", "Servicii"],
  ["/oferte-locale", "Oferte"], ["/unde-mancam", "Unde mâncăm"], ["/locuri-de-munca", "Joburi"],
];

export function Logo() {
  return <Link className="logo" href="/" aria-label="Blaj Azi — Acasă"><span>Blaj</span><b>Azi</b></Link>;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  useEffect(() => { document.body.style.overflow = open || search ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open, search]);
  return (
    <>
      <header className="site-header">
        <div className="nav-wrap">
          <Logo />
          <nav className="desktop-nav" aria-label="Navigație principală">
            {mainNav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <div className="header-actions">
            <button className="icon-button" aria-label="Deschide căutarea" onClick={() => setSearch(true)}><Search size={20} /></button>
            <Link className="button button-small" href="/adauga-o-afacere"><Plus size={17} /> Adaugă</Link>
            <button className="icon-button menu-button" aria-label="Deschide meniul" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button>
          </div>
        </div>
      </header>
      {open && <div className="overlay-panel" role="dialog" aria-modal="true" aria-label="Meniu">
        <div className="overlay-top"><Logo /><button className="icon-button" aria-label="Închide meniul" onClick={() => setOpen(false)}><X /></button></div>
        <nav className="mobile-nav">{mainNav.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/informatii-utile" onClick={() => setOpen(false)}>Informații utile</Link><Link href="/despre" onClick={() => setOpen(false)}>Despre</Link></nav>
      </div>}
      {search && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Căutare în site">
        <button className="icon-button search-close" aria-label="Închide căutarea" onClick={() => setSearch(false)}><X /></button>
        <div className="search-dialog"><p className="eyebrow">Caută în ghidul local</p><h2>Ce cauți în Blaj?</h2><form action="/cauta"><Search /><input name="q" aria-label="Termen de căutare" placeholder="restaurant, electrician, eveniment…" /><button className="button" type="submit">Caută</button></form><div className="search-suggestions"><span>Căutări rapide:</span><Link href="/unde-mancam">meniul zilei</Link><Link href="/evenimente">weekend</Link><Link href="/locuri-de-munca">joburi</Link></div></div>
      </div>}
    </>
  );
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="footer-grid"><div><Logo /><p>Ghid local independent pentru Blaj și comunitățile din apropiere. Conținutul demonstrativ este marcat clar.</p></div><div><h3>Explorează</h3><Link href="/descopera-blaj">Descoperă Blaj</Link><Link href="/evenimente">Evenimente</Link><Link href="/afaceri-si-servicii">Afaceri și servicii</Link><Link href="/informatii-utile">Informații utile</Link></div><div><h3>Pentru comunitate</h3><Link href="/adauga-o-afacere">Adaugă o afacere</Link><Link href="/adauga-un-eveniment">Adaugă un eveniment</Link><Link href="/contribuie">Trimite o fotografie sau poveste</Link><Link href="/contact">Raportează o informație</Link></div><div><h3>Despre</h3><Link href="/despre">Despre proiect</Link><Link href="/promovare">Promovare</Link><Link href="/confidentialitate">Confidențialitate</Link><Link href="/cookie-uri">Cookie-uri</Link><Link href="/termeni">Termeni</Link></div></div><div className="footer-base"><span>© 2026 Blaj Azi</span><span>Făcut cu grijă pentru comunitatea din Blaj.</span><Link href="/admin">Administrare</Link></div></footer>;
}
