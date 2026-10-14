import { LogoCard, LogoMarquee } from "@ryanmeetup/ui";
import type { LogoCardProps, LogoMarqueeProps } from "@ryanmeetup/ui";

export type SponsorLogo = {
  name: string;
  src: string;
  /** Shown in dark mode instead of `src`. */
  darkSrc?: string;
  href: string;
};
export type SponsorLogoCardProps = SponsorLogo &
  Omit<LogoCardProps, "alt" | "src" | "href">;
const SponsorLogoCard = ({ name, ...props }: SponsorLogoCardProps) => (
  <LogoCard alt={name} {...props} />
);

export type SponsorLogoMarqueeProps = Omit<LogoMarqueeProps, "items"> & {
  sponsors: SponsorLogo[];
  imageClassName?: string;
};
const SponsorLogoMarquee = ({
  sponsors,
  imageClassName,
  ...props
}: SponsorLogoMarqueeProps) => (
  <LogoMarquee
    items={sponsors.map(({ name, ...sponsor }) => ({
      ...sponsor,
      alt: name,
      key: name,
      imageClassName,
    }))}
    {...props}
  />
);

export { SponsorLogoCard, SponsorLogoMarquee };
