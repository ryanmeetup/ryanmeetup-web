// Components
import { Kicker, SectionHeader } from "@ryanmeetup/ui";
import { RegionGrid } from "@/components/name-change/RegionGrid";

// Types
import type { RegionItem } from "@/components/name-change/regions";

type RegionSectionProps = {
  title: string;
  subtitle: string;
  items: RegionItem[];
  region: "usa" | "canada";
  id?: string;
};

const RegionSection = (props: RegionSectionProps) => {
  const { title, subtitle, items, region, id } = props;

  return (
    <section id={id} className="scroll-mt-24">
      <SectionHeader
        title={title}
        meta={
          <Kicker className="w-full lg:w-auto">
            {subtitle}
          </Kicker>
        }
        align="left"
        className="mb-4"
        headingClassName="text-2xl title sm:text-3xl"
      />
      <RegionGrid items={items} region={region} />
    </section>
  );
};

export { RegionSection };
