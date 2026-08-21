import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateHub, DetailPage, DiscoverPage, ListingPage, SearchPage, StaticPage, SubmissionPage } from "../ui/PublicPages";
import { routes } from "../data";
import { cmsImageUrl } from "../site-content";
import { loadPublicCatalog } from "../server/public-data";
import { loadPublishedSiteContent, loadPublishedSiteContentSet } from "../server/site-content";
import { canManageEntity, getOptionalAccount, isAdmin } from "../server/platform";

type RawParams = Record<string, string | string[] | undefined>;
const filterKeys = new Set(["q", "type", "locality", "category", "period", "cost", "verified", "service", "salary", "transport", "sort"]);
const listingKeys: Record<string, string> = {
  evenimente: "listing.events", "afaceri-si-servicii": "listing.businesses", "oferte-locale": "listing.offers",
  "unde-mancam": "listing.restaurants", "locuri-de-munca": "listing.jobs", "informatii-utile": "listing.useful", "povesti-locale": "listing.stories",
};
const staticKeys: Record<string, string> = { despre: "page.about", confidentialitate: "page.privacy", "cookie-uri": "page.cookies", termeni: "page.terms" };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function safeParams(input: RawParams) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const item = first(value)?.trim();
    if (filterKeys.has(key) && item && item.length <= 120 && /^[\p{L}\p{N}\s.,+\-_/]{1,120}$/u.test(item)) output[key] = item;
  }
  return output;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const [catalog, seo] = await Promise.all([loadPublicCatalog(), loadPublishedSiteContent("seo.defaults")]);
  const current = routes.find(([key]) => key === slug[0]);
  const pools: Record<string, Array<{ id: string; title?: string; name?: string; description?: string; image?: string; isDemo?: boolean }>> = {
    evenimente: catalog.events, "afaceri-si-servicii": catalog.businesses, "oferte-locale": catalog.offers, "unde-mancam": catalog.restaurants,
    "locuri-de-munca": catalog.jobs, "descopera-blaj": catalog.places, "povesti-locale": catalog.posts,
  };
  const detail = slug[1] ? pools[slug[0]]?.find(item => item.id === slug[1]) : undefined;
  const overrides = (Array.isArray(seo.pages) ? seo.pages : []).find(value => value && typeof value === "object" && (value as { route?: string }).route === `/${slug.join("/")}`) as { title?: string; description?: string; canonicalPath?: string; socialImage?: unknown } | undefined;
  const title = overrides?.title || detail?.title || detail?.name || current?.[1] || (slug[0] === "cauta" ? String(seo.openGraphTitle || "Caută în Blaj") : String(seo.defaultTitle || "Blaj Azi"));
  const description = overrides?.description || detail?.description?.slice(0, 155) || String(seo.description || `${title} — informație locală clară și verificată pentru Blaj și împrejurimi.`);
  const image = overrides?.socialImage ? cmsImageUrl(overrides.socialImage) : detail?.image || cmsImageUrl(seo.openGraphImage);
  const canonical = overrides?.canonicalPath || `/${slug.join("/")}`;
  return {
    title, description, alternates: { canonical }, robots: slug[0] === "cauta" || detail?.isDemo ? { index: false, follow: true } : undefined,
    openGraph: { title, description, type: slug[0] === "povesti-locale" ? "article" : "website", url: canonical, images: image ? [{ url: image, alt: title }] : [] },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : [] },
  };
}

export default async function CatchAllPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<RawParams> }) {
  const { slug } = await params;
  const raw = await searchParams;
  const query = safeParams(raw);
  const [section, id] = slug;
  const catalog = await loadPublicCatalog();

  if (id) {
    const pools: Record<string, Array<{ id: string; contentId?: number }>> = { evenimente: catalog.events, "afaceri-si-servicii": catalog.businesses, "oferte-locale": catalog.offers, "unde-mancam": catalog.restaurants, "locuri-de-munca": catalog.jobs, "descopera-blaj": catalog.places, "povesti-locale": catalog.posts };
    const item = pools[section]?.find(entry => entry.id === id);
    if (!item) notFound();
    const account = await getOptionalAccount().catch(() => null);
    const canEdit = Boolean(account && item.contentId && await canManageEntity(account, item.contentId));
    return <DetailPage section={section} id={id} catalog={catalog} viewer={{ signedIn: Boolean(account), canEdit, canAdmin: Boolean(account && isAdmin(account)) }} content={await loadPublishedSiteContent("global.detail")} />;
  }

  if (section === "descopera-blaj") return <DiscoverPage catalog={catalog} content={await loadPublishedSiteContent("discover")} />;
  if (listingKeys[section]) return <ListingPage slug={section} catalog={catalog} initialFilters={query} content={await loadPublishedSiteContent(listingKeys[section])} />;
  if (section === "cauta") return <SearchPage initial={query.q || ""} initialType={query.type || "all"} catalog={catalog} content={await loadPublishedSiteContent("global.search")} />;
  if (section === "adauga") return <CreateHub content={await loadPublishedSiteContent("forms.hub")} />;
  if (["adauga-o-afacere", "adauga-un-eveniment", "adauga-o-oferta", "adauga-un-job", "contribuie", "contact", "promovare"].includes(section)) {
    const [account, formCopy] = await Promise.all([getOptionalAccount().catch(() => null), loadPublishedSiteContentSet(["forms.submissions", "page.contact", "page.promotion"])]);
    const kinds: Record<string, string> = { "adauga-o-afacere": "business", "adauga-un-eveniment": "event", "adauga-o-oferta": "offer", "adauga-un-job": "job", contribuie: "contribution", contact: "contact", promovare: "promotion" };
    let context;
    const target = Number(first(raw.target));
    if (section === "contact" && target) {
      const item = [...catalog.events, ...catalog.businesses, ...catalog.offers, ...catalog.restaurants, ...catalog.jobs, ...catalog.places, ...catalog.posts].find(entry => entry.contentId === target);
      if (item) context = { targetContentId: target, targetTitle: "title" in item ? item.title : item.name, targetUrl: first(raw.from)?.startsWith("/") ? first(raw.from) : undefined };
    }
    const submissionCopy = section === "contact" ? { ...formCopy["forms.submissions"], ...formCopy["page.contact"] } : formCopy["forms.submissions"];
    return <SubmissionPage kind={kinds[section]} account={account ? { displayName: account.displayName, email: account.email } : null} context={context} content={submissionCopy} promotionContent={formCopy["page.promotion"]} />;
  }
  if (staticKeys[section]) return <StaticPage content={await loadPublishedSiteContent(staticKeys[section])} />;
  notFound();
}
