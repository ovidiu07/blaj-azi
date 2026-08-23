import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateHub, DiscoverPage, ListingPage, StaticPage } from "../../../ui/PublicPages";
import { HomeExperience } from "../../../ui/HomeExperience";
import { loadAdminSiteContent, loadPublishedSiteContent } from "../../../server/site-content";
import { loadPublicCatalog } from "../../../server/public-data";
import { isAdmin, requireAccountForPage } from "../../../server/platform";
import { homeThemeCssProperties, themeCssProperties } from "../../../theme";

export const dynamic = "force-dynamic";
export const metadata = { title: "Previzualizare ciornă", robots: { index: false, follow: false } };

const listings: Record<string, string> = {
  "listing.events": "evenimente", "listing.businesses": "afaceri-si-servicii", "listing.offers": "oferte-locale",
  "listing.restaurants": "unde-mancam", "listing.jobs": "locuri-de-munca", "listing.useful": "informatii-utile", "listing.stories": "povesti-locale",
};

export default async function CmsDraftPreview({ params }: { params: Promise<{ key: string }> }) {
  const key = decodeURIComponent((await params).key);
  const account = await requireAccountForPage(`/admin/previzualizare/${encodeURIComponent(key)}`, "/admin/conectare");
  if (!isAdmin(account)) notFound();
  const [entry, catalog, homeEntry, publishedTheme] = await Promise.all([loadAdminSiteContent(account, key).catch(() => null), loadPublicCatalog(), key === "theme.site" ? loadAdminSiteContent(account, "home") : Promise.resolve(null), loadPublishedSiteContent("theme.site")]);
  if (!entry) notFound();
  let preview: React.ReactNode;
  if (key === "theme.site") preview = <div className="home-theme theme-draft-preview" style={{...themeCssProperties(entry.draft),...homeThemeCssProperties(entry.draft)} as React.CSSProperties}><HomeExperience catalog={catalog} content={homeEntry?.published || {}} /></div>;
  else if (key === "home") preview = <div className="home-theme" style={homeThemeCssProperties(publishedTheme) as React.CSSProperties}><HomeExperience catalog={catalog} content={entry.draft} /></div>;
  else if (key === "discover") preview = <DiscoverPage catalog={catalog} content={entry.draft} />;
  else if (listings[key]) preview = <ListingPage slug={listings[key]} catalog={catalog} content={entry.draft} />;
  else if (key === "forms.hub") preview = <CreateHub content={entry.draft} />;
  else if (key.startsWith("page.") && Array.isArray(entry.draft.blocks)) preview = <StaticPage content={entry.draft} />;
  else preview = <section className="container cms-preview-message"><p className="eyebrow">Previzualizare componentă globală</p><h1>{entry.label}</h1><p>Această ciornă se poate verifica în contextul paginii publice după publicare. Câmpurile rămân validate și private până atunci.</p></section>;
  return <><div className="cms-preview-bar"><strong>Previzualizare ciornă · {entry.label}</strong><span>Ciorna este privată și nu este publicată.</span><Link href={`/admin/pagini/${encodeURIComponent(key)}`}>Înapoi la editor</Link></div>{preview}</>;
}
