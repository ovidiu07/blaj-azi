import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalAccount } from "../server/platform";
import { safeReturnPath } from "../server/auth";
import { AuthForm, AuthPage } from "../ui/AuthForms";

export const metadata: Metadata = { title: "Conectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/cont");
  if (await getOptionalAccount().catch(() => null)) redirect(returnTo);
  return <AuthPage eyebrow="Contul tău" title="Bine ai revenit" copy="Conectează-te pentru a administra materialele și afacerile tale."><AuthForm mode="login" returnTo={returnTo} /></AuthPage>;
}
