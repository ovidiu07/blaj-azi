import { HomeExperience } from "./ui/HomeExperience";
import { loadPublicCatalog } from "./server/public-data";
import { loadPublishedSiteContent } from "./server/site-content";

export const dynamic = "force-dynamic";
export default async function Home() {
  const [catalog, content] = await Promise.all([loadPublicCatalog(), loadPublishedSiteContent("home")]);
  return <HomeExperience catalog={catalog} content={content} />;
}
