import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Доска /app у каждого посетителя своя — индексировать там нечего
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/app/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
