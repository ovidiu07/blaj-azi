import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateHub, DiscoverPage, ListingPage, StaticPage } from "../../../ui/PublicPages";
import { HomeExperience } from "../../../ui/HomeExperience";
import { loadAdminSiteContent } from "../../../server/site-content";
import { loadPublicCatalog } from "../../../server/public-data";
import { isAdmin, requireAccountForPage } from "../../../server/platform";

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
  const [entry, catalog] = await Promise.all([loadAdminSiteContent(account, key).catch(() => null), loadPublicCatalog()]);
  if (!entry) notFound();
  let preview: React.ReactNode;
  if (key === "home") preview = <HomeExperience catalog={catalog} content={entry.draft} />;
  else if (key === "discover") preview = <DiscoverPage catalog={catalog} content={entry.draft} />;
  else if (listings[key]) preview = <ListingPage slug={listings[key]} catalog={catalog} content={entry.draft} />;
  else if (key === "forms.hub") preview = <CreateHub content={entry.draft} />;
  else if (key.startsWith("page.") && Array.isArray(entry.draft.blocks)) preview = <StaticPage content={entry.draft} />;
  else preview = <section className="container cms-preview-message"><p className="eyebrow">Previzualizare componentă globală</p><h1>{entry.label}</h1><p>Această ciornă se poate verifica în contextul paginii publice după publicare. Câmpurile rămân validate și private până atunci.</p></section>;
  return <><div className="cms-preview-bar"><strong>Previzualizare ciornă · {entry.label}</strong><span>Ciorna este privată și nu este publicată.</span><Link href={`/admin/pagini/${encodeURIComponent(key)}`}>Înapoi la editor</Link></div>{preview}</>;
}
