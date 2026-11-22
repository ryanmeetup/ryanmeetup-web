import { serializeJsonLd } from "@/lib/structured-data";

/** A schema.org block for search engines; renders nothing visible. */
export function JsonLd({ id, data }: { id?: string; data: object }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
