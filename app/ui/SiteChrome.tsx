"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogIn, LogOut, Menu, Plus, Search, UserRound, X } from "lucide-react";
import { Dispatch, RefObject, SetStateAction, useEffect, useRef, useState } from "react";

type HeaderAccount = { displayName: string; globalRole: string; unread: number } | null;
type Copy = Record<string, unknown>;
type CmsLink = { href: string; label: string };
const label = (copy: Copy, key: string) => String(copy[key] || "");

export function Logo({ homeLabel = "Blaj Azi — Acasă" }: { homeLabel?: string }) {
  return <Link className="logo" href="/" aria-label={homeLabel}><span>Blaj</span><b>Azi</b></Link>;
}

export function SiteHeader({ account, content, searchContent }: { account: HeaderAccount; content: Copy; searchContent: Copy }) {
  const pathname = usePathname();
  const mainNav = (Array.isArray(content.navigation) ? content.navigation : []) as CmsLink[];
  const supplemental = (Array.isArray(content.mobileSupplemental) ? content.mobileSupplemental : []) as CmsLink[];
  const quickLinks = (Array.isArray(searchContent.quickLinks) ? searchContent.quickLinks : []) as CmsLink[];
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
          <Logo homeLabel={label(content, "homeLabel")} />
          <nav className="desktop-nav" aria-label="Navigație principală">
            {mainNav.map(item => <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href)?"page":undefined}>{item.label}</Link>)}
          </nav>
          <div className="header-actions">
            <button ref={searchTrigger} className="icon-button" aria-label="Deschide căutarea" aria-expanded={search} onClick={() => setSearch(true)}><Search size={20} /></button>
            {account ? <details className="account-menu"><summary aria-label="Deschide meniul contului"><span className="account-avatar">{initials(account.displayName)}</span><span className="account-name">{account.displayName}</span>{account.unread > 0 && <span className="notification-count" aria-label={`${account.unread} notificări necitite`}>{account.unread}</span>}<ChevronDown size={15} /></summary><div className="account-popover"><strong>{account.displayName}</strong><small>{roleLabel(account.globalRole)}</small><Link href="/cont"><UserRound /> {label(content, "accountLabel")}</Link><Link href="/cont/continut">Conținutul meu</Link>{["business_owner","admin","platform_owner"].includes(account.globalRole) && <Link href="/cont/afaceri">Afacerea mea</Link>}{["admin","platform_owner"].includes(account.globalRole) && <Link href="/admin">{label(content, "adminLabel")}</Link>}<Link href="/cont/notificari"><Bell /> Notificări {account.unread > 0 && `(${account.unread})`}</Link><Link href="/deconectare"><LogOut /> Deconectare</Link></div></details> : <div className="guest-actions"><Link className="register-link" href="/inregistrare?return_to=%2Fcont">{label(content, "registerLabel")}</Link><Link className="signin-link" href="/conectare?return_to=%2Fcont"><LogIn size={17} /> {label(content, "loginLabel")}</Link></div>}
            <Link className="button button-small" href="/adauga" aria-current={pathname==="/adauga"?"page":undefined}><Plus size={17} /> {label(content, "addLabel")}</Link>
            <button ref={menuTrigger} className="icon-button menu-button" aria-label={label(content, "menuLabel")} aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button>
          </div>
        </div>
      </header>
      {open && <div ref={menuDialog} className="overlay-panel" role="dialog" aria-modal="true" aria-label="Meniu">
        <div className="overlay-top"><Logo homeLabel={label(content, "homeLabel")} /><button className="icon-button" aria-label="Închide meniul" onClick={() => setOpen(false)}><X /></button></div>
        <nav className="mobile-nav"><Link className="mobile-create-link" href="/adauga" onClick={() => setOpen(false)}><Plus/>{label(content, "addLabel")}</Link>{mainNav.map(item => <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href)?"page":undefined} onClick={() => setOpen(false)}>{item.label}</Link>)}{supplemental.map(item => <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>{item.label}</Link>)}<span className="mobile-nav-divider" />{account ? <><Link href="/cont" onClick={() => setOpen(false)}>{label(content, "accountLabel")}</Link><Link href="/cont/continut" onClick={() => setOpen(false)}>Conținutul meu</Link>{["business_owner","admin","platform_owner"].includes(account.globalRole) && <Link href="/cont/afaceri" onClick={() => setOpen(false)}>Afacerea mea</Link>}{["admin","platform_owner"].includes(account.globalRole) && <Link href="/admin" onClick={() => setOpen(false)}>{label(content, "adminLabel")}</Link>}<Link href="/deconectare" onClick={() => setOpen(false)}>Deconectare</Link></> : <><Link href="/conectare?return_to=%2Fcont" onClick={() => setOpen(false)}>{label(content, "loginLabel")}</Link><Link href="/inregistrare?return_to=%2Fcont" onClick={() => setOpen(false)}>{label(content, "registerLabel")}</Link></>}</nav>
      </div>}
      {search && <div ref={searchDialog} className="search-overlay" role="dialog" aria-modal="true" aria-label="Căutare în site">
        <button className="icon-button search-close" aria-label="Închide căutarea" onClick={() => setSearch(false)}><X /></button>
        <div className="search-dialog"><p className="eyebrow">{label(searchContent, "overlayEyebrow")}</p><h2>{label(searchContent, "title")}</h2><form action="/cauta" method="get"><label className="sr-only" htmlFor="site-search">Termen de căutare</label><Search aria-hidden="true"/><input id="site-search" name="q" placeholder={label(searchContent, "placeholder")}/><button className="button" type="submit">{label(searchContent, "buttonLabel")}</button></form><div className="search-suggestions"><span>{label(searchContent, "quickLabel")}</span>{quickLinks.map(item => <Link href={item.href} key={item.href}>{item.label}</Link>)}</div></div>
      </div>}
    </>
  );
}

export function SiteFooter({ showAdmin = false, content, homeLabel }: { showAdmin?: boolean; content: Copy; homeLabel: string }) {
  const columns = (Array.isArray(content.columns) ? content.columns : []) as Array<{ heading: string; links: CmsLink[] }>;
  return <footer className="site-footer"><div className="footer-grid"><div><Logo homeLabel={homeLabel} /><p>{label(content, "intro")}</p></div>{columns.map(column => <div key={column.heading}><h3>{column.heading}</h3>{column.links.map(item => <Link href={item.href} key={item.href}>{item.label}</Link>)}</div>)}</div><div className="footer-base"><span>{label(content, "copyrightTemplate").replace("{year}", String(new Date().getFullYear()))}</span><span>{label(content, "closing")}</span>{showAdmin && <Link href="/admin">Administrare</Link>}</div></footer>;
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
