import NextImage from "next/image";
import { Card, Heading, Text } from "@ryanmeetup/ui";
import { gallery } from "@/lib/constants";

const Moments = () => {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <Heading className="text-4xl title" size="h2">
          Moments from the Ryan Meetup
        </Heading>
        <Text className="mt-2 text-base text-black/70 dark:text-white/70">
          A growing archive of Ryans showing up for each other.
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {gallery.map((photo, index) => (
          <Card key={index} variant="soft" size="sm" hover>
            <div className="relative aspect-[3/2] w-full max-h-[420px] overflow-hidden rounded-2xl">
              <NextImage
                src={photo.imageUrl}
                fill
                alt={photo.title}
                style={{ objectFit: "cover" }}
                sizes="(max-width: 640px) 100vw,
                  (max-width: 768px) 100vw,
                  (max-width: 1024px) 100vw,
                  (max-width: 1280px) 100vw,
                  (max-width: 1536px) 100vw"
              />
            </div>
            <Text className="text-center mt-3 text-sm uppercase tracking-caps text-black/70 dark:text-white/70">
              {photo.title}
            </Text>
          </Card>
        ))}
      </div>
    </section>
  );
};

export { Moments };
