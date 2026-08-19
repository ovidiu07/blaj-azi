"use client";

import Link from "next/link";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "register" | "admin";

export function AuthPage({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: React.ReactNode }) {
  return <section className="auth-shell"><div className="auth-context"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p><ul><li>Sesiune protejată pe server</li><li>Datele tale nu sunt publicate automat</li><li>Contribuțiile rămân moderate înainte de publicare</li></ul><Link href="/">Înapoi la Blaj Azi</Link></div><div className="auth-card">{children}</div></section>;
}

export function AuthForm({ mode, returnTo }: { mode: AuthMode; returnTo: string }) {
  const registration = mode === "register";
  const admin = mode === "admin";
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      email: form.get("email"),
      password: form.get("password"),
      remember: form.get("remember") === "on",
      returnTo,
      admin,
    };
    if (registration) Object.assign(payload, {
      name: form.get("name"),
      passwordConfirmation: form.get("passwordConfirmation"),
      acceptTerms: form.get("acceptTerms") === "on",
      acceptPrivacy: form.get("acceptPrivacy") === "on",
    });
    try {
      const response = await fetch(registration ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) {
        setMessage(data.error || "Nu am putut finaliza conectarea.");
        return;
      }
      window.location.assign(data.returnTo || (admin ? "/admin" : "/cont"));
    } catch {
      setMessage("Conexiunea nu este disponibilă momentan. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    {message && <div className="form-alert form-alert-error" role="alert" tabIndex={-1}>{message}</div>}
    {registration && <label>Nume complet<input name="name" autoComplete="name" minLength={2} maxLength={180} required /></label>}
    <label>Adresă de e-mail<input name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required /></label>
    <label>Parolă<span className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete={registration ? "new-password" : "current-password"} minLength={12} maxLength={128} aria-describedby={registration ? "password-hint" : undefined} required /><button type="button" className="password-toggle" aria-label={visible ? "Ascunde parola" : "Arată parola"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff /> : <Eye />}</button></span></label>
    {registration && <><small id="password-hint" className="field-hint">Folosește cel puțin 12 caractere și o parolă pe care nu o utilizezi în altă parte.</small><label>Confirmă parola<input name="passwordConfirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required /></label></>}
    {registration ? <div className="auth-checks"><label className="check-row"><input type="checkbox" name="acceptTerms" required /><span>Accept <Link href="/termeni" target="_blank">Termenii de utilizare</Link>.</span></label><label className="check-row"><input type="checkbox" name="acceptPrivacy" required /><span>Am citit <Link href="/confidentialitate" target="_blank">Politica de confidențialitate</Link>.</span></label></div> : <label className="check-row"><input type="checkbox" name="remember" /><span>Ține-mă minte pe acest dispozitiv</span></label>}
    <button className="button auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" /> Se verifică…</> : registration ? "Creează contul" : admin ? <><ShieldCheck /> Intră în administrare</> : <><LockKeyhole /> Conectează-te</>}</button>
    <p className="auth-alternative">{registration ? <>Ai deja cont? <Link href={`/conectare?return_to=${encodeURIComponent(returnTo)}`}>Conectează-te</Link></> : <>Nu ai încă un cont? <Link href={`/inregistrare?return_to=${encodeURIComponent(returnTo)}`}>Înregistrează-te</Link></>}</p>
  </form>;
}

export function LogoutForm({ returnTo = "/" }: { returnTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function logout() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnTo }) });
      const data = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) setMessage(data.error || "Deconectarea nu a reușit.");
      else window.location.assign(data.returnTo || "/");
    } catch {
      setMessage("Deconectarea nu a reușit. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="logout-actions">{message && <div className="form-alert form-alert-error" role="alert">{message}</div>}<button className="button" onClick={logout} disabled={busy}>{busy ? <><LoaderCircle className="spin" /> Se deconectează…</> : <><LogOut /> Deconectează-mă</>}</button><Link className="button button-outline" href="/cont">Înapoi la cont</Link></div>;
}
