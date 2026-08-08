import type { Metadata } from "next";
import { DetailPage, DiscoverPage, ListingPage, SearchPage, StaticPage, SubmissionPage } from "../ui/PublicPages";
import { routes } from "../data";
import { loadPublicCatalog } from "../server/public-data";
import { canManageEntity, getOptionalAccount, isAdmin } from "../server/platform";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog=await loadPublicCatalog();
  const current = routes.find(([key]) => key === slug[0]);
  const detailPools: Record<string, Array<{ id: string; title?: string; name?: string }>> = { "evenimente": catalog.events, "afaceri-si-servicii": catalog.businesses, "oferte-locale": catalog.offers, "unde-mancam": catalog.restaurants, "locuri-de-munca": catalog.jobs, "descopera-blaj": catalog.places,"povesti-locale":catalog.posts };
  const detail = slug[1] ? detailPools[slug[0]]?.find(item => item.id === slug[1]) : undefined;
  const title = detail?.title || detail?.name || current?.[1] || (slug[0] === "cauta" ? "Caută în Blaj" : "Blaj Azi");
  return { title, description: `${title} — informație locală clară și utilă pentru Blaj și împrejurimi.`, alternates: { canonical: `/${slug.join("/")}` } };
}

export default async function CatchAllPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params; const query = await searchParams; const [section, id] = slug;
  const catalog=await loadPublicCatalog();
  if (id) {
    const pools:Record<string,Array<{id:string;contentId?:number}>>={"evenimente":catalog.events,"afaceri-si-servicii":catalog.businesses,"oferte-locale":catalog.offers,"unde-mancam":catalog.restaurants,"locuri-de-munca":catalog.jobs,"descopera-blaj":catalog.places,"povesti-locale":catalog.posts};
    const item=pools[section]?.find(entry=>entry.id===id);const account=await getOptionalAccount().catch(()=>null);const canEdit=Boolean(account&&item?.contentId&&await canManageEntity(account,item.contentId));
    return <DetailPage section={section} id={id} catalog={catalog} viewer={{signedIn:Boolean(account),canEdit,canAdmin:Boolean(account&&isAdmin(account))}} />;
  }
  if (section === "descopera-blaj") return <DiscoverPage catalog={catalog} />;
  if (["evenimente", "afaceri-si-servicii", "oferte-locale", "unde-mancam", "locuri-de-munca", "informatii-utile","povesti-locale"].includes(section)) return <ListingPage slug={section} catalog={catalog} />;
  if (section === "cauta") return <SearchPage initial={query.q || ""} catalog={catalog} />;
  if (["adauga-o-afacere","adauga-un-eveniment","adauga-o-oferta","adauga-un-job","contribuie","contact","promovare"].includes(section)) {
    const account=await getOptionalAccount().catch(()=>null);const kinds:Record<string,string>={"adauga-o-afacere":"business","adauga-un-eveniment":"event","adauga-o-oferta":"offer","adauga-un-job":"job",contribuie:"contribution",contact:"contact",promovare:"promotion"};
    return <SubmissionPage kind={kinds[section]} account={account?{displayName:account.displayName,email:account.email}:null}/>;
  }
  if (["despre", "confidentialitate", "cookie-uri", "termeni"].includes(section)) return <StaticPage slug={section} />;
  return <StaticPage slug="despre" />;
}
