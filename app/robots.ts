import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cont", "/conectare", "/inregistrare", "/cauta"] }],
    sitemap: "https://blaj-azi.ro/sitemap.xml",
    host: "https://blaj-azi.ro",
  };
}
