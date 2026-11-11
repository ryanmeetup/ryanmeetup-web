// Components
import NextImage from "next/image";

// Utilities
import { gallery } from "@/lib/constants";

const MasonryGrid = () => {
  const photoItems = [
    ...gallery.map((item, index) => ({
      ...item,
      variant: index % 5 === 0 ? "tall" : index % 4 === 0 ? "wide" : "standard",
    })),
  ];

  return (
    <div className="columns-1 gap-5 space-y-5 sm:columns-2 lg:columns-4">
      {photoItems.map((item) => (
        <figure
          key={item.imageUrl}
          className="group break-inside-avoid overflow-hidden rounded-2xl border border-black/10 bg-white/80 shadow-sm transition hover:-translate-y-1 hover:border-black/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/40"
        >
          <div
            className={`relative w-full ${
              item.variant === "tall"
                ? "aspect-[3/4]"
                : item.variant === "wide"
                  ? "aspect-[16/9]"
                  : "aspect-[4/3]"
            }`}
          >
            <NextImage
              src={item.imageUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
          <figcaption className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-black/70 dark:text-white/70">
            <span className="font-semibold text-black/80 dark:text-white/85">
              {item.title}
            </span>
            <span className="text-xs uppercase tracking-caps-wide text-black/40 dark:text-white/40">
              Photo
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
};

export { MasonryGrid };
