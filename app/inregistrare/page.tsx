import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalAccount } from "../server/platform";
import { safeReturnPath } from "../server/auth";
import { AuthForm, AuthPage } from "../ui/AuthForms";

export const metadata: Metadata = { title: "Înregistrare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/cont");
  if (await getOptionalAccount().catch(() => null)) redirect(returnTo);
  return <AuthPage eyebrow="Alătură-te comunității" title="Creează un cont Blaj Azi" copy="Păstrează-ți contribuțiile într-un singur loc și urmărește parcursul lor prin moderare."><AuthForm mode="register" returnTo={returnTo} /></AuthPage>;
}
