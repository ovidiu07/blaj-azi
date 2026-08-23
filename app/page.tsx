import { HomeExperience } from "./ui/HomeExperience";
import { loadPublicCatalog } from "./server/public-data";
import { loadPublishedSiteContent } from "./server/site-content";
import { homeThemeCssProperties } from "./theme";

export const dynamic = "force-dynamic";
export default async function Home() {
  const [catalog, content, theme] = await Promise.all([loadPublicCatalog(), loadPublishedSiteContent("home"), loadPublishedSiteContent("theme.site")]);
  return <div className="home-theme" style={homeThemeCssProperties(theme) as React.CSSProperties}><HomeExperience catalog={catalog} content={content} /></div>;
}
