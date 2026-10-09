import { Button, Card, IconBadge, Text } from "@ryanmeetup/ui";
import { BiMailSend as Send } from "react-icons/bi";
import { GoSponsorTiers as SponsorDetails } from "react-icons/go";
import { contactHrefs } from "@/utils/contact";
import {
  FaBullhorn as Megaphone,
  FaEnvelopeOpenText as Newsletter,
  FaInstagram as Instagram,
  FaRegCalendarCheck as Calendar,
  FaTshirt as Activation,
  FaVideo as Video,
} from "react-icons/fa";

const partnershipPerks = [
  {
    icon: <Megaphone className="h-4 w-4" />,
    label: "Backer recognition",
    text: "Logo placement in the Monthly Backers grid, from a standard listing up to a larger, first-row spot depending on tier.",
  },
  {
    icon: <Newsletter className="h-4 w-4" />,
    label: "Newsletter recognition",
    text: "From plain-text mentions to full visual logo placement whenever we send a newsletter — new events, chapters, or big Ryan news.",
  },
  {
    icon: <Instagram className="h-4 w-4" />,
    label: "Instagram recognition",
    text: "Periodic Instagram Stories recognition and rotating sponsor spotlights for Operations and Sustaining Partners.",
  },
  {
    icon: <Video className="h-4 w-4" />,
    label: "Event-recap visibility",
    text: "Logo inclusion in event-recap content, with expanded credits in National Event recap graphics for Sustaining Partners.",
  },
  {
    icon: <Activation className="h-4 w-4" />,
    label: "On-site presence",
    text: "Agreed signage, a verbal thank-you, and an on-site activation at a National Event for Sustaining Partners.",
  },
  {
    icon: <Calendar className="h-4 w-4" />,
    label: "Custom collaborations",
    text: "Custom event and brand collaborations scoped around your specific idea — pricing discussed based on scope.",
  },
];

type PartnershipPerksProps = {
  detailsHref?: string;
  showDetailsLink?: boolean;
};

const PartnershipPerks = (props: PartnershipPerksProps) => {
  const { detailsHref = "#sponsorship-info", showDetailsLink = true } = props;

  return (
    <>
      <div className="sm:hidden">
        <details className="details-reveal group">
          <summary className="mx-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/20 bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/80 shadow-sm transition hover:border-black/40 hover:bg-black/5 dark:border-white/20 dark:bg-white/10 dark:text-white/80 dark:hover:border-white/40 dark:hover:bg-white/10">
            View partnership perks
            <span className="text-xs leading-none transition-transform duration-200 group-open:rotate-180">
              ▼
            </span>
          </summary>
          <Card
            variant="soft"
            size="md"
            className="mt-4 grid w-full gap-4 text-left"
          >
            {partnershipPerks.map((item) => (
              <Card key={item.label} variant="solid" size="sm">
                <div className="flex items-start gap-3">
                  <IconBadge size="sm">{item.icon}</IconBadge>
                  <Text className="text-sm text-black/70 dark:text-white/70">
                    <span className="font-semibold text-black dark:text-white">
                      {item.label}
                    </span>{" "}
                    — {item.text}
                  </Text>
                </div>
              </Card>
            ))}
          </Card>
        </details>
      </div>
      <Card
        variant="soft"
        size="md"
        className="mx-auto hidden w-full gap-4 text-left sm:grid sm:grid-cols-2 xl:grid-cols-3"
      >
        <div className="sm:col-span-2 xl:col-span-3">
          <Text className="text-xs font-semibold uppercase tracking-[0.3em] text-black/70 dark:text-white/70">
            Sponsor opportunities may include...
          </Text>
        </div>
        {partnershipPerks.map((item) => (
          <Card key={item.label} variant="solid" size="sm">
            <div className="flex items-start gap-3">
              <IconBadge size="sm">{item.icon}</IconBadge>
              <Text className="text-sm text-black/70 dark:text-white/70">
                <span className="font-semibold text-black dark:text-white">
                  {item.label}
                </span>{" "}
                — {item.text}
              </Text>
            </div>
          </Card>
        ))}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {showDetailsLink && (
          <Button.Link
            href={detailsHref}
            leftIcon={<SponsorDetails className="h-4 w-4" />}
            variant="secondary"
            size="md"
            fullWidth
            newTab={false}
          >
            View partnership details
          </Button.Link>
        )}
        <Button.Link
          href={contactHrefs.sponsorship}
          leftIcon={<Send className="h-4 w-4" />}
          variant="primary"
          size="md"
          fullWidth
          newTab={false}
        >
          Get in contact
        </Button.Link>
      </div>
    </>
  );
};

export { PartnershipPerks };
