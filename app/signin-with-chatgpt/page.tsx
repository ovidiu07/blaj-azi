import { redirect } from "next/navigation";
import { safeReturnPath } from "../server/auth";

export const dynamic = "force-dynamic";

export default async function CompatibilitySignIn({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).return_to, "/cont");
  redirect(`/conectare?return_to=${encodeURIComponent(returnTo)}`);
}
