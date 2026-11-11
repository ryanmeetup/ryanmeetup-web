"use client";

import { useEffect, useState } from "react";
import { FiLink } from "react-icons/fi";

const previewCache = new Map<string, string | null>();

const sizeClasses = { sm: "h-9 w-9", md: "h-10 w-10", lg: "h-12 w-12" };

export function LinkPreviewThumbnail({
  url,
  size = "sm",
}: {
  url: string;
  size?: keyof typeof sizeClasses;
}) {
  const [loadedPreview, setLoadedPreview] = useState<{
    url: string;
    imageUrl: string | null;
  } | null>(() =>
    previewCache.has(url)
      ? { url, imageUrl: previewCache.get(url) ?? null }
      : null,
  );
  const imageUrl =
    loadedPreview?.url === url
      ? loadedPreview.imageUrl
      : (previewCache.get(url) ?? null);

  useEffect(() => {
    if (previewCache.has(url)) return;

    const controller = new AbortController();
    void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as { imageUrl?: unknown };
        return typeof body.imageUrl === "string" ? body.imageUrl : null;
      })
      .then((nextImageUrl) => {
        previewCache.set(url, nextImageUrl);
        setLoadedPreview({ url, imageUrl: nextImageUrl });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [url]);

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-black/5 text-black/50 dark:bg-white/5 dark:text-white/50 ${sizeClasses[size]}`}
    >
      {imageUrl ? (
        // The image host comes from arbitrary user-linked Open Graph metadata,
        // so it cannot be enumerated in Next's static remote image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => {
            previewCache.set(url, null);
            setLoadedPreview({ url, imageUrl: null });
          }}
        />
      ) : (
        <FiLink aria-hidden />
      )}
    </span>
  );
}
