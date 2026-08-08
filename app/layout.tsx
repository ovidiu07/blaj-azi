import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { SiteFooter, SiteHeader } from "./ui/SiteChrome";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body className={`${display.variable} ${sans.variable}`}>
        <a className="skip-link" href="#continut">Sari la conținut</a>
        <SiteHeader />
        <main id="continut">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
