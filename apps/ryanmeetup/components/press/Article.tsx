// Components
import NextLink from "next/link";
import NextImage from "next/image";
import { Card, Heading, Pill, Text } from "@ryanmeetup/ui";

// Types
import type { Article } from "@/lib/types";
import { convertImageUrl } from "@ryanmeetup/utils";

// Utilities
import { isMoreThanTwoWeeksAgo } from "@ryanmeetup/utils";

type ArticleProps = {
  article: Article;
};

type ArticleImageProps = {
  imageSrc: string;
  title: string;
};

const ArticleImage = (props: ArticleImageProps) => {
  const { imageSrc, title } = props;

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <NextImage
        className="h-full w-full object-cover"
        src={imageSrc}
        fill
        alt={title}
      />
    </div>
  );
};

const Article = (props: ArticleProps) => {
  const { title, author, outlet, href, publishedOn, thumbnail } = props.article;

  const highlight = "font-semibold text-blue-700 dark:text-blue-500";
  const imageUrl = convertImageUrl(thumbnail);

  const isNew = !isMoreThanTwoWeeksAgo(publishedOn);

  return (
    <NextLink href={href} target="_blank" className="block">
      <Card variant="soft" size="md" hover className="group relative">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_2fr] xl:items-stretch">
          <div className="xl:self-center">
            <ArticleImage imageSrc={imageUrl ?? "/trophy.png"} title={title} />
          </div>

          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <Pill variant="neutral" size="md">
                {publishedOn}
              </Pill>
              {isNew && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caps-wide text-emerald-600 dark:text-emerald-300">
                  New
                </span>
              )}
            </div>

            <div className="mt-4 flex-1 space-y-3">
              <Heading className="title text-3xl sm:text-4xl" size="h2">
                {title}
              </Heading>

              <Text className="text-lg text-black/70 dark:text-white/70">
                by <span className={highlight}>{author}</span> at{" "}
                <span className={highlight}>{outlet}</span>
              </Text>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-black/70 transition group-hover:text-black dark:text-white/70 dark:group-hover:text-white">
              Read
              <span className="text-base">→</span>
            </div>
          </div>
        </div>
      </Card>
    </NextLink>
  );
};

export { Article };
