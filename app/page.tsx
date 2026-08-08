import { HomeExperience } from "./ui/HomeExperience";
import { loadPublicCatalog } from "./server/public-data";

export const dynamic = "force-dynamic";
export default async function Home() {
  return <HomeExperience catalog={await loadPublicCatalog()} />;
}
