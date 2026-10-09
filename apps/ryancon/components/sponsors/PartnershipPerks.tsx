import { contactHrefs } from "@/utils/contact";
import { Button, Card, IconBadge, Text } from "@ryanmeetup/ui";
import { BiMailSend as Send } from "react-icons/bi";
import { GoSponsorTiers as SponsorDetails } from "react-icons/go";
import {
  FaBullhorn as Megaphone,
  FaHandshake as Handshake,
  FaInstagram as Instagram,
  FaMicrophoneAlt as Mic,
  FaStore as Activation,
  FaVideo as Video,
} from "react-icons/fa";

const partnershipPerks = [
  {
    icon: <Megaphone className="h-4 w-4" />,
    text: "Logo placement across RyanCon web, event, and promotional materials.",
  },
  {
    icon: <Activation className="h-4 w-4" />,
    text: "On-site booths, branded experiences, and memorable attendee activations.",
  },
  {
    icon: <Handshake className="h-4 w-4" />,
    text: "Custom partnership opportunities aligned with your brand and goals.",
  },
  {
    icon: <Instagram className="h-4 w-4" />,
    text: "Visibility through RyanCon and Ryan Meetup social storytelling.",
  },
  {
    icon: <Video className="h-4 w-4" />,
    text: "Inclusion in event recaps and content that extends beyond RyanCon itself.",
  },
  {
    icon: <Mic className="h-4 w-4" />,
    text: "Stage recognition and sponsor mentions when the program format fits.",
  },
];

type PartnershipPerksProps = {
  detailsHref?: string;
  showDetailsLink?: boolean;
};

const PartnershipPerks = ({
  detailsHref = "/sponsorship",
  showDetailsLink = true,
}: PartnershipPerksProps) => (
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
            <Card key={item.text} variant="solid" size="sm">
              <div className="flex items-start gap-3">
                <IconBadge size="sm">{item.icon}</IconBadge>
                <Text className="text-sm text-black/70 dark:text-white/70">
                  {item.text}
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
          RyanCon sponsor opportunities may include...
        </Text>
      </div>
      {partnershipPerks.map((item) => (
        <Card key={item.text} variant="solid" size="sm">
          <div className="flex items-start gap-3">
            <IconBadge size="sm">{item.icon}</IconBadge>
            <Text className="text-sm text-black/70 dark:text-white/70">
              {item.text}
            </Text>
          </div>
        </Card>
      ))}
    </Card>

    <div className="flex flex-col justify-center gap-3 sm:flex-row">
      {showDetailsLink && (
        <Button.Link
          href={detailsHref}
          leftIcon={<SponsorDetails className="h-4 w-4" />}
          variant="secondary"
          size="md"
          fullWidth
          newTab={false}
        >
          View sponsorship details
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
        Partner with RyanCon
      </Button.Link>
    </div>
  </>
);

export { PartnershipPerks };
