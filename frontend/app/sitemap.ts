import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Публичные страницы: лендинг сервиса, сайт студии с формой и песочница разбора
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/pixel`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/try`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
