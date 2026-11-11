// Components
import { Heading, Kicker } from "@ryanmeetup/ui";
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
      <div className="mb-4 flex items-center justify-between">
        <Heading className="text-2xl title sm:text-3xl" size="h2">
          {title}
        </Heading>
        <Kicker>{subtitle}</Kicker>
      </div>
      <RegionGrid items={items} region={region} />
    </section>
  );
};

export { RegionSection };
