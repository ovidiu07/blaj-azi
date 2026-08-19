import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeReturnPath } from "../../server/auth";
import { getOptionalAccount, isAdmin } from "../../server/platform";
import { AuthForm, AuthPage } from "../../ui/AuthForms";

export const metadata: Metadata = { title: "Conectare administrare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/admin");
  const account = await getOptionalAccount().catch(() => null);
  if (account && isAdmin(account)) redirect(returnTo);
  return <AuthPage eyebrow="Acces protejat" title="Administrare Blaj Azi" copy="Folosește același cont, cu drepturi administrative acordate pe server."><AuthForm mode="admin" returnTo={returnTo} /></AuthPage>;
}
