import type { MetadataRoute } from "next";
import { loadPublicCatalog } from "./server/public-data";

const origin = "https://blaj-azi.ro";
const core = ["", "/descopera-blaj", "/evenimente", "/afaceri-si-servicii", "/oferte-locale", "/unde-mancam", "/locuri-de-munca", "/informatii-utile", "/povesti-locale", "/despre", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadPublicCatalog();
  const details = [
    ...catalog.events.map((item) => ["evenimente", item] as const),
    ...catalog.businesses.map((item) => ["afaceri-si-servicii", item] as const),
    ...catalog.offers.map((item) => ["oferte-locale", item] as const),
    ...catalog.restaurants.map((item) => ["unde-mancam", item] as const),
    ...catalog.jobs.map((item) => ["locuri-de-munca", item] as const),
    ...catalog.places.map((item) => ["descopera-blaj", item] as const),
    ...catalog.posts.map((item) => ["povesti-locale", item] as const),
  ].filter(([, item]) => !item.isDemo);
  return [
    ...core.map((path) => ({ url: `${origin}${path}`, changeFrequency: path ? "daily" as const : "hourly" as const, priority: path ? 0.7 : 1 })),
    ...details.map(([section, item]) => ({ url: `${origin}/${section}/${item.id}`, lastModified: item.updatedAt ? new Date(item.updatedAt) : undefined, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
