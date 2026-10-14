"use client";

// Components
import { Card, Text, ThemedImage } from "@ryanmeetup/ui";
import { SponsorLink } from "@/components/sponsors/SponsorLink";

// Types
import type { Sponsor } from "@/lib/types";

// Utilities
import { convertImageUrl } from "@ryanmeetup/utils";

type SponsorProps = {
  sponsor: Sponsor;
  className?: string;
  imageWrapperClassName?: string;
  imageClassName?: string;
  size?: "default" | "featured" | "compact";
  placement?: string;
};

const Sponsor = (props: SponsorProps) => {
  const {
    name,
    darkModeImage,
    lightModeImage,
    href,
    partnershipType,
    backerDescription,
  } = props.sponsor;
  const {
    className,
    imageWrapperClassName,
    imageClassName,
    size = "default",
    placement = "sponsor_grid",
  } = props;

  return (
    <SponsorLink
      href={href}
      sponsorName={name}
      placement={placement}
      partnershipType={partnershipType}
      className={`group flex w-full ${className}`}
    >
      <Card
        variant="soft"
        size={size === "default" ? "md" : "sm"}
        hover
        className="flex h-full w-full flex-col items-center justify-center gap-3 text-center"
      >
        <div
          className={`relative mx-auto w-full max-w-[660px] ${
            size === "default"
              ? "h-48 sm:h-[216px]"
              : size === "featured"
                ? "h-32 sm:h-36"
                : "h-24 sm:h-28"
          } ${imageWrapperClassName ?? ""}`}
        >
          <ThemedImage
            src={convertImageUrl(lightModeImage) as string}
            darkSrc={convertImageUrl(darkModeImage) as string}
            fill
            alt={name}
            className={`object-contain ${imageClassName ?? ""}`}
            sizes="(min-width: 1280px) 660px, (min-width: 640px) 540px, 480px"
          />
        </div>
        {partnershipType === "Recurring Sponsor" && backerDescription && (
          <Text className="line-clamp-2 text-sm text-black/70 dark:text-white/70">
            {backerDescription}
          </Text>
        )}
      </Card>
    </SponsorLink>
  );
};

export { Sponsor };
