import type { ReactNode } from "react";
import { Heading } from "./Heading";
import { Kicker } from "./Kicker";
import { Text } from "./Text";

export type SectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Classes for the meta/actions container, e.g. `max-sm:hidden` to drop it at a breakpoint without leaving its gap behind. */
  actionsClassName?: string;
  className?: string;
  headingClassName?: string;
  align?: "left" | "center" | "responsive";
  layout?: "responsive" | "split";
  headingLevel?: "h1" | "h2" | "h3";
};

const SectionHeader = ({
  title,
  description,
  meta,
  actions,
  actionsClassName,
  className,
  headingClassName = "text-3xl title sm:text-4xl",
  align = "responsive",
  layout = "responsive",
  headingLevel = "h2",
}: SectionHeaderProps) => {
  const alignment = {
    left: "text-left",
    center: "items-center text-center",
    responsive: "text-center lg:text-left",
  }[align];
  const metaAlignment = align === "left" ? "justify-start lg:justify-end" : "justify-center lg:justify-end";
  const metaNode =
    typeof meta === "string" || typeof meta === "number" ? (
      <Kicker>{meta}</Kicker>
    ) : (
      meta
    );

  return (
    <div className={`flex flex-col gap-2 ${alignment} ${className ?? ""}`}>
      <div className={layout === "split" ? "flex flex-wrap items-end justify-between gap-x-4 gap-y-2" : "flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between"}>
        <Heading className={`${layout === "split" ? "min-w-0 max-w-full break-words " : ""}${headingClassName}`} size={headingLevel}>
          {title}
        </Heading>
        {(metaNode || actions) && (
          <div className={`flex flex-wrap items-center gap-3 ${layout === "split" ? "ml-auto justify-end text-right" : metaAlignment} ${actionsClassName ?? ""}`}>
            {metaNode}
            {actions}
          </div>
        )}
      </div>
      {description && <Text>{description}</Text>}
    </div>
  );
};

export { SectionHeader };
