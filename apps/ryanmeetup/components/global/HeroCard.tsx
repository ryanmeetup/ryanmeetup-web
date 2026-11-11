import NextImage from "next/image";
import { Heading, Pill, Text } from "@ryanmeetup/ui";
import type { ReactNode } from "react";

type HeroCardImage = {
  src: string;
  alt: string;
  eyebrow?: string;
  title?: string;
};

type HeroCardProps = {
  title: string;
  description: ReactNode;
  badges: string[];
  image: HeroCardImage;
};

const HeroCard = (props: HeroCardProps) => {
  const { title, description, badges, image } = props;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 p-6 shadow-drop dark:border-white/10 dark:bg-white/5 lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]" />
      <div className="absolute -top-24 right-10 hidden h-64 w-64 rounded-full border border-black/10 bg-white/60 blur-3xl dark:border-white/10 dark:bg-white/10 lg:block" />
      <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <Heading className="text-4xl title sm:text-5xl" size="h1">
            {title}
          </Heading>
          <Text className="text-lg text-black/70 dark:text-white/70">
            {description}
          </Text>
          <div className="flex flex-wrap gap-3">
            {badges.map((badge) => (
              <Pill key={badge} variant="subtle">
                {badge}
              </Pill>
            ))}
          </div>
        </div>
        <div className="relative h-56 overflow-hidden rounded-3xl border border-black/10 shadow-2xl sm:h-80 lg:h-[360px] dark:border-white/10">
          <NextImage
            className="rounded-3xl"
            fill
            src={image.src}
            alt={image.alt}
            style={{ objectFit: "cover" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {(image.eyebrow || image.title) && (
            <div className="absolute bottom-5 left-5 space-y-1">
              {image.eyebrow && (
                <Text className="text-xs uppercase tracking-caps text-white/70">
                  {image.eyebrow}
                </Text>
              )}
              {image.title && (
                <Text className="text-xl font-cooper text-white">
                  {image.title}
                </Text>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export { HeroCard };
