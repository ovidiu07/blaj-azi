"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogIn, LogOut, Menu, Plus, Search, UserRound, X } from "lucide-react";
import { Dispatch, RefObject, SetStateAction, useEffect, useRef, useState } from "react";

type HeaderAccount = { displayName: string; globalRole: string; unread: number } | null;

const mainNav = [
  ["/descopera-blaj", "Descoperă Blaj"], ["/evenimente", "Evenimente"], ["/afaceri-si-servicii", "Servicii"],
  ["/oferte-locale", "Oferte"], ["/unde-mancam", "Unde mâncăm"], ["/locuri-de-munca", "Joburi"],
];

export function Logo() {
  return <Link className="logo" href="/" aria-label="Blaj Azi — Acasă"><span>Blaj</span><b>Azi</b></Link>;
}

export function SiteHeader({ account }: { account: HeaderAccount }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuDialog = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchDialog = useRef<HTMLDivElement>(null);
  useDialogFocus(open, setOpen, menuTrigger, menuDialog);
  useDialogFocus(search, setSearch, searchTrigger, searchDialog);
  useEffect(() => { document.body.style.overflow = open || search ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open, search]);
  return (
    <>
      <header className="site-header">
        <div className="nav-wrap">
          <Logo />
          <nav className="desktop-nav" aria-label="Navigație principală">
            {mainNav.map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href)?"page":undefined}>{label}</Link>)}
            <Link href="/povesti-locale" aria-current={pathname.startsWith("/povesti-locale")?"page":undefined}>Povești</Link>
          </nav>
          <div className="header-actions">
            <button ref={searchTrigger} className="icon-button" aria-label="Deschide căutarea" aria-expanded={search} onClick={() => setSearch(true)}><Search size={20} /></button>
            {account ? <details className="account-menu"><summary aria-label="Deschide meniul contului"><span className="account-avatar">{initials(account.displayName)}</span><span className="account-name">{account.displayName}</span>{account.unread > 0 && <span className="notification-count" aria-label={`${account.unread} notificări necitite`}>{account.unread}</span>}<ChevronDown size={15} /></summary><div className="account-popover"><strong>{account.displayName}</strong><small>{roleLabel(account.globalRole)}</small><Link href="/cont"><UserRound /> Contul meu</Link><Link href="/cont/continut">Conținutul meu</Link>{["business_owner","admin","platform_owner"].includes(account.globalRole) && <Link href="/cont/afaceri">Afacerea mea</Link>}{["admin","platform_owner"].includes(account.globalRole) && <Link href="/admin">Administrare</Link>}<Link href="/cont/notificari"><Bell /> Notificări {account.unread > 0 && `(${account.unread})`}</Link><Link href="/deconectare"><LogOut /> Deconectare</Link></div></details> : <div className="guest-actions"><Link className="register-link" href="/inregistrare?return_to=%2Fcont">Înregistrare</Link><Link className="signin-link" href="/conectare?return_to=%2Fcont"><LogIn size={17} /> Conectează-te</Link></div>}
            <Link className="button button-small" href="/adauga" aria-current={pathname==="/adauga"?"page":undefined}><Plus size={17} /> Adaugă</Link>
            <button ref={menuTrigger} className="icon-button menu-button" aria-label="Deschide meniul" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button>
          </div>
        </div>
      </header>
      {open && <div ref={menuDialog} className="overlay-panel" role="dialog" aria-modal="true" aria-label="Meniu">
        <div className="overlay-top"><Logo /><button className="icon-button" aria-label="Închide meniul" onClick={() => setOpen(false)}><X /></button></div>
        <nav className="mobile-nav"><Link className="mobile-create-link" href="/adauga" onClick={() => setOpen(false)}><Plus/>Adaugă informație</Link>{mainNav.map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href)?"page":undefined} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/povesti-locale" onClick={() => setOpen(false)}>Povești locale</Link><Link href="/informatii-utile" onClick={() => setOpen(false)}>Informații utile</Link><Link href="/despre" onClick={() => setOpen(false)}>Despre</Link><span className="mobile-nav-divider" />{account ? <><Link href="/cont" onClick={() => setOpen(false)}>Contul meu</Link><Link href="/cont/continut" onClick={() => setOpen(false)}>Conținutul meu</Link>{["business_owner","admin","platform_owner"].includes(account.globalRole) && <Link href="/cont/afaceri" onClick={() => setOpen(false)}>Afacerea mea</Link>}{["admin","platform_owner"].includes(account.globalRole) && <Link href="/admin" onClick={() => setOpen(false)}>Administrare</Link>}<Link href="/deconectare" onClick={() => setOpen(false)}>Deconectare</Link></> : <><Link href="/conectare?return_to=%2Fcont" onClick={() => setOpen(false)}>Conectează-te</Link><Link href="/inregistrare?return_to=%2Fcont" onClick={() => setOpen(false)}>Înregistrare</Link></>}</nav>
      </div>}
      {search && <div ref={searchDialog} className="search-overlay" role="dialog" aria-modal="true" aria-label="Căutare în site">
        <button className="icon-button search-close" aria-label="Închide căutarea" onClick={() => setSearch(false)}><X /></button>
        <div className="search-dialog"><p className="eyebrow">Caută în ghidul local</p><h2>Ce cauți în Blaj?</h2><form action="/cauta" method="get"><label className="sr-only" htmlFor="site-search">Termen de căutare</label><Search aria-hidden="true"/><input id="site-search" name="q" placeholder="restaurant, electrician, eveniment…"/><button className="button" type="submit">Caută</button></form><div className="search-suggestions"><span>Căutări rapide:</span><Link href="/unde-mancam">meniul zilei</Link><Link href="/evenimente?period=weekend">weekend</Link><Link href="/locuri-de-munca">joburi</Link></div></div>
      </div>}
    </>
  );
}

export function SiteFooter({ showAdmin = false }: { showAdmin?: boolean }) {
  return <footer className="site-footer"><div className="footer-grid"><div><Logo /><p>Ghid local independent pentru Blaj și comunitățile din apropiere. Publicăm informații reale după verificare.</p></div><div><h3>Explorează</h3><Link href="/descopera-blaj">Descoperă Blaj</Link><Link href="/evenimente">Evenimente</Link><Link href="/afaceri-si-servicii">Afaceri și servicii</Link><Link href="/informatii-utile">Informații utile</Link></div><div><h3>Pentru comunitate</h3><Link href="/adauga">Adaugă informație</Link><Link href="/adauga-un-eveniment">Adaugă un eveniment</Link><Link href="/contribuie">Trimite o fotografie sau poveste</Link><Link href="/contact">Raportează o informație</Link></div><div><h3>Despre</h3><Link href="/despre">Despre proiect</Link><Link href="/promovare">Promovare</Link><Link href="/confidentialitate">Confidențialitate</Link><Link href="/cookie-uri">Cookie-uri</Link><Link href="/termeni">Termeni</Link></div></div><div className="footer-base"><span>© 2026 Blaj Azi</span><span>Făcut cu grijă pentru comunitatea din Blaj.</span>{showAdmin && <Link href="/admin">Administrare</Link>}</div></footer>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "U"; }
function roleLabel(role: string) { return role === "business_owner" ? "Proprietar de afacere" : role === "admin" ? "Administrator" : role === "platform_owner" ? "Proprietar platformă" : "Utilizator"; }

function useDialogFocus(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  trigger: RefObject<HTMLButtonElement | null>,
  dialog: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open || !dialog.current) return;
    const panel = dialog.current;
    const triggerElement = trigger.current;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    panel.addEventListener("keydown", keydown);
    return () => {
      panel.removeEventListener("keydown", keydown);
      triggerElement?.focus();
    };
  }, [dialog, open, setOpen, trigger]);
}
