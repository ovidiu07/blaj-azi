import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Manrope } from "next/font/google";
import { SiteFooter, SiteHeader } from "./ui/SiteChrome";
import { getOptionalAccount, isAdmin } from "./server/platform";
import { getRuntimeDb } from "../db/runtime";
import { loadPublishedSiteContentSet } from "./server/site-content";
import { cmsImageUrl, resolveCmsImage } from "./site-content";
import { themeCssProperties } from "./theme";
import "./globals.css";

const display = Manrope({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const metadataContent = await loadPublishedSiteContentSet(["seo.defaults", "theme.site"]);
  const seo = metadataContent["seo.defaults"];
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const socialImage = resolveCmsImage(seo.openGraphImage);
  const image = new URL(cmsImageUrl(socialImage) || "/og.png", base).toString();
  return {
    metadataBase: base,
    title: { default: String(seo.defaultTitle), template: String(seo.titleTemplate) },
    description: String(seo.description),
    alternates: { canonical: "/" },
    openGraph: { title: String(seo.openGraphTitle), description: String(seo.openGraphDescription), locale: "ro_RO", type: "website", url: "/", images: [{ url: image, width: 1200, height: 630, alt: socialImage.alt }] },
    twitter: { card: seo.twitterCard === "summary" ? "summary" : "summary_large_image", images: [image] },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    themeColor: String(metadataContent["theme.site"].primaryDark),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [account, siteCopy] = await Promise.all([getOptionalAccount().catch(() => null), loadPublishedSiteContentSet(["global.header", "global.footer", "global.search", "theme.site"])]);
  const unread = account ? await getRuntimeDb().prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL").bind(account.id).first<{ count: number }>().then(row => row?.count ?? 0).catch(() => 0) : 0;
  return (
    <html lang="ro">
      <body className={`${display.variable} ${sans.variable}`} style={themeCssProperties(siteCopy["theme.site"]) as React.CSSProperties}>
        <a className="skip-link" href="#continut">Sari la conținut</a>
        <SiteHeader account={account ? { displayName: account.displayName, globalRole: account.globalRole, unread } : null} content={siteCopy["global.header"]} searchContent={siteCopy["global.search"]} />
        <main id="continut">{children}</main>
        <SiteFooter showAdmin={Boolean(account && isAdmin(account))} content={siteCopy["global.footer"]} homeLabel={String(siteCopy["global.header"].homeLabel)} />
      </body>
    </html>
  );
}
