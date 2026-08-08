import type { Metadata } from "next";
import { DetailPage, DiscoverPage, ListingPage, SearchPage, StaticPage, SubmissionPage } from "../ui/PublicPages";
import { businesses, events, jobs, offers, places, restaurants, routes } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const current = routes.find(([key]) => key === slug[0]);
  const detailPools: Record<string, Array<{ id: string; title?: string; name?: string }>> = { "evenimente": events, "afaceri-si-servicii": businesses, "oferte-locale": offers, "unde-mancam": restaurants, "locuri-de-munca": jobs, "descopera-blaj": places };
  const detail = slug[1] ? detailPools[slug[0]]?.find(item => item.id === slug[1]) : undefined;
  const title = detail?.title || detail?.name || current?.[1] || (slug[0] === "cauta" ? "Caută în Blaj" : "Blaj Azi");
  return { title, description: `${title} — informație locală clară și utilă pentru Blaj și împrejurimi.`, alternates: { canonical: `/${slug.join("/")}` } };
}

export default async function CatchAllPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params; const query = await searchParams; const [section, id] = slug;
  if (id) return <DetailPage section={section} id={id} />;
  if (section === "descopera-blaj") return <DiscoverPage />;
  if (["evenimente", "afaceri-si-servicii", "oferte-locale", "unde-mancam", "locuri-de-munca", "informatii-utile"].includes(section)) return <ListingPage slug={section} />;
  if (section === "cauta") return <SearchPage initial={query.q || ""} />;
  if (section === "adauga-o-afacere") return <SubmissionPage kind="business" />;
  if (section === "adauga-un-eveniment") return <SubmissionPage kind="event" />;
  if (section === "adauga-o-oferta") return <SubmissionPage kind="offer" />;
  if (section === "adauga-un-job") return <SubmissionPage kind="job" />;
  if (section === "contribuie") return <SubmissionPage kind="contribution" />;
  if (section === "contact") return <SubmissionPage kind="contact" />;
  if (section === "promovare") return <SubmissionPage kind="promotion" />;
  if (["despre", "confidentialitate", "cookie-uri", "termeni"].includes(section)) return <StaticPage slug={section} />;
  return <StaticPage slug="despre" />;
}
