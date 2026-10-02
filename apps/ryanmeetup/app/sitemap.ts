import {
  fetchArticles,
  fetchChapters,
  fetchEvents,
} from "@/actions/fetchContent";
import type { MetadataRoute } from "next";

const BASE_URL = "https://ryanmeetup.com";

const staticRoutes = [
  "",
  "/about",
  "/events",
  "/events/upcoming",
  "/rytoberfest",
  "/press",
  "/chapters",
  "/gallery",
  "/awards",
  "/sponsors",
  "/sponsors/partnerships",
  "/charity",
  "/donate",
  "/contact",
  "/map",
  "/name-change",
  "/faq",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const [events, chapters, articles] = await Promise.all([
      fetchEvents(),
      fetchChapters(),
      fetchArticles(),
    ]);

    (events as { href?: string; date?: string | Date }[]).forEach((event) => {
      if (!event.href) return;
      entries.push({
        url: event.href.startsWith("http")
          ? event.href
          : `${BASE_URL}${event.href}`,
        lastModified: event.date ? new Date(event.date) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    });

    (chapters as { slug?: string; updatedAt?: string }[]).forEach((chapter) => {
      if (!chapter.slug) return;
      entries.push({
        url: `${BASE_URL}/chapters/${chapter.slug}`,
        lastModified: chapter.updatedAt
          ? new Date(chapter.updatedAt)
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    });

    (articles as { href?: string; publishDate?: string | Date }[]).forEach(
      (article) => {
        if (!article.href) return;
        entries.push({
          url: article.href.startsWith("http")
            ? article.href
            : `${BASE_URL}${article.href}`,
          lastModified: article.publishDate
            ? new Date(article.publishDate)
            : new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
        });
      },
    );
  } catch {
    // If content fetch fails, fall back to static routes only.
  }

  return entries;
}
