import type { ContentfulImage } from "@/lib/types";

// Contentful serves protocol-relative asset URLs, which `convertImageUrl`
// turns into an `images.ctfassets.net` origin that `next.config` allows.
const createImage = (name: string): ContentfulImage =>
  ({
    fields: {
      title: "Test Image",
      description: "",
      file: {
        url: `//images.ctfassets.net/fixture/${name}`,
        fileName: "test.png",
        contentType: "image/png",
        details: {
          image: {
            height: 1,
            width: 1,
          },
          size: 1,
        },
      },
    },
  }) as ContentfulImage;

export { createImage };
