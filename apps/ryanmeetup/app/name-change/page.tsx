// Components
import { Layout } from "@/components/navigation";
import { AnchorNav, Divider } from "@ryanmeetup/ui";
import {
  NameChangeHero,
  RegionSection,
  US_STATES,
  CANADA_PROVINCES,
  AVAILABLE_FORMS_COUNT,
  AVAILABLE_CANADA_FORMS_COUNT,
} from "@/components/name-change";
import { FaCanadianMapleLeaf, FaFlagUsa } from "react-icons/fa6";
import { layoutPaddingX } from "@/lib/constants";

// Types
import { buildPageMetadata } from "@/utils/metadata";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Name Change",
  description:
    "Download name change paperwork by state. All 50 states in one place.",
  canonical: "https://ryanmeetup.com/name-change",
  image: {
    url: "https://ryanmeetup.com/meta/name-change.jpg",
    width: 1341,
    height: 958,
  },
});

const NameChangePage = () => {
  const anchorIconStyle = "h-5 w-5";
  const formatRegionSubtitle = (available: number, total: number) =>
    available === 0
      ? `${total} forms coming soon`
      : `${available} forms available`;
  const anchors = [
    {
      icon: <FaFlagUsa className={anchorIconStyle} />,
      href: "#united-states",
      tooltip: "United States",
    },
    {
      icon: <FaCanadianMapleLeaf className={anchorIconStyle} />,
      href: "#canada",
      tooltip: "Canada",
    },
  ];

  return (
    <Layout fullscreen>
      <div className="relative">
        <AnchorNav items={anchors} />
        <section className={`pb-20 pt-8 ${layoutPaddingX}`}>
          <NameChangeHero />

          <Divider margins="xl" />

          <RegionSection
            id="united-states"
            title="United States"
            subtitle={formatRegionSubtitle(
              AVAILABLE_FORMS_COUNT,
              US_STATES.length,
            )}
            items={US_STATES}
            region="usa"
          />

          <Divider margins="xl" />

          <RegionSection
            id="canada"
            title="Canada"
            subtitle={formatRegionSubtitle(
              AVAILABLE_CANADA_FORMS_COUNT,
              CANADA_PROVINCES.length,
            )}
            items={CANADA_PROVINCES}
            region="canada"
          />
        </section>
      </div>
    </Layout>
  );
};

export default NameChangePage;
