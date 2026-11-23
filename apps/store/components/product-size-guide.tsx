"use client";

import { useMemo, useState } from "react";
import { LuRuler } from "react-icons/lu";
import { Button, FilterChip, Modal } from "@ryanmeetup/ui";
import { getSizeGuideTables, mergeSizeGuideUnits } from "@/lib/product-guidance";

type Unit = "inches" | "centimeters";
const units: { value: Unit; label: string }[] = [{ value: "inches", label: "Inches" }, { value: "centimeters", label: "Centimeters" }];

/** Countries that still measure clothing in inches; everyone else opens on centimetres. */
function preferredUnit(): Unit {
  const region = (() => {
    try { return new Intl.Locale(navigator.language).maximize().region; } catch { return undefined; }
  })();
  return !region || ["US", "LR", "MM"].includes(region) ? "inches" : "centimeters";
}

/** Sits beside the Size label; the negative margin keeps the tap target without growing the row. */
export function ProductSizeGuide({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<Unit>("inches");
  const tables = useMemo(() => getSizeGuideTables(html), [html]);
  const options = units.flatMap(({ value }) => (tables[value] ? [{ value, html: tables[value] }] : []));
  const shown = options.some((option) => option.value === unit) ? unit : options[0]?.value;
  const merged = shown ? mergeSizeGuideUnits(tables, shown) : null;

  function openGuide() {
    setUnit(preferredUnit());
    setOpen(true);
  }

  return (
    <>
      <span className="-my-2 flex shrink-0">
        <Button size="sm" variant="link" leftIcon={<LuRuler />} aria-haspopup="dialog" onClick={openGuide}>Size guide</Button>
      </span>
      <Modal open={open} setIsOpen={setOpen} title="Size guide" size="fit" dismissOnOutsideClick>
        {tables.inches && tables.centimeters && (
          <div role="group" aria-label="Units" className="mb-4 flex gap-2">
            {units.map(({ value, label }) => (
              <FilterChip key={value} active={unit === value} onClick={() => setUnit(value)}>{label}</FilterChip>
            ))}
          </div>
        )}
        <p className="mb-4 text-sm text-black/70 sm:hidden dark:text-white/70">Scroll sideways to see every measurement.</p>
        {/* The same Shopify-authored tables remain in Product details. */}
        <div role="region" aria-label="Size measurements" tabIndex={0} className="overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40">
          {/* One table carries both units so neither the dialog nor its columns resize on a switch;
              when the tables don't line up, both share one grid cell so at least the dialog holds still. */}
          {merged ? (
            <div className="rich-text [&_table]:table [&_table]:max-w-none" dangerouslySetInnerHTML={{ __html: merged }} />
          ) : <div className="grid">
            {options.map((option) => (
              <div
                key={option.value}
                aria-hidden={option.value !== shown || undefined}
                className={`rich-text col-start-1 row-start-1 [&_table]:table [&_table]:max-w-none ${option.value === shown ? "" : "invisible"}`}
                dangerouslySetInnerHTML={{ __html: option.html }}
              />
            ))}
          </div>}
        </div>
      </Modal>
    </>
  );
}
