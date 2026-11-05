import type { Metadata } from "next";

type PageMetadataImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

type SiteMetadataConfig = {
  siteName: string;
  siteUrl: string;
  locale?: string;
};

type PageMetadataOptions = {
  title: string;
  description: string;
  canonical: string;
  image: PageMetadataImage;
  metadataBase?: string;
  keywords?: string[];
  robots?: Metadata["robots"];
  siteName?: string;
};

const resolveMetadataUrl = (value: string, metadataBase: string) => {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return new URL(value, metadataBase).toString();
};

// Next.js treats a key that is present but undefined as "clear the parent's
// value", so optional fields are only added when set. Otherwise a page without
// `robots` would silently drop a layout-wide noindex.
const createPageMetadataBuilder = (site: SiteMetadataConfig) => {
  return (options: PageMetadataOptions): Metadata => {
    const { title, description, canonical, image, keywords, robots } = options;
    const metadataBase = options.metadataBase ?? site.siteUrl;
    const resolvedCanonical = resolveMetadataUrl(canonical, metadataBase);
    const resolvedImage = {
      ...image,
      url: resolveMetadataUrl(image.url, metadataBase),
    };

    return {
      metadataBase: new URL(metadataBase),
      title,
      description,
      ...(keywords ? { keywords } : {}),
      ...(robots ? { robots } : {}),
      alternates: {
        canonical: resolvedCanonical,
      },
      openGraph: {
        url: resolvedCanonical,
        title,
        description,
        siteName: options.siteName ?? site.siteName,
        images: [resolvedImage],
        locale: site.locale ?? "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [resolvedImage.url],
      },
    };
  };
};

export { createPageMetadataBuilder };
export type { PageMetadataImage, PageMetadataOptions, SiteMetadataConfig };
