import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalAccount } from "../server/platform";
import { safeReturnPath } from "../server/auth";
import { AuthForm, AuthPage } from "../ui/AuthForms";
import { loadPublishedSiteContent } from "../server/site-content";

export const metadata: Metadata = { title: "Conectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/cont");
  if (await getOptionalAccount().catch(() => null)) redirect(returnTo);
  const content = await loadPublishedSiteContent("auth.login");
  return <AuthPage eyebrow={String(content.eyebrow)} title={String(content.title)} copy={String(content.intro)} benefits={Array.isArray(content.benefits) ? content.benefits.map(String) : []}><AuthForm mode="login" returnTo={returnTo} /></AuthPage>;
}
