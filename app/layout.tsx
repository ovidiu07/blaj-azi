import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { SiteFooter, SiteHeader } from "./ui/SiteChrome";
import { getOptionalAccount, isAdmin } from "./server/platform";
import { getRuntimeDb } from "../db/runtime";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});
const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title: { default: "Blaj Azi — Ghidul local al Blajului", template: "%s | Blaj Azi" },
    description: "Evenimente, servicii, restaurante, oferte, joburi și locuri de descoperit în Blaj și împrejurimi.",
    openGraph: { title: "Blaj Azi", description: "Tot ce contează în Blaj, într-un singur loc.", locale: "ro_RO", type: "website", images: [{ url: image, width: 1536, height: 1024, alt: "Blaj Azi — ghidul comunității locale" }] },
    twitter: { card: "summary_large_image", images: [image] },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const account = await getOptionalAccount().catch(() => null);
  const unread = account ? await getRuntimeDb().prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL").bind(account.id).first<{ count: number }>().then(row => row?.count ?? 0).catch(() => 0) : 0;
  return (
    <html lang="ro">
      <body className={`${display.variable} ${sans.variable}`}>
        <a className="skip-link" href="#continut">Sari la conținut</a>
        <SiteHeader account={account ? { displayName: account.displayName, globalRole: account.globalRole, unread } : null} />
        <main id="continut">{children}</main>
        <SiteFooter showAdmin={Boolean(account && isAdmin(account))} />
      </body>
    </html>
  );
}
