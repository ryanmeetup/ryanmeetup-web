import type { HTMLAttributes } from "react";
import { Text } from "./Text";

export type Testimonial = { quote: string; location: string };
export type TestimonialCardProps = HTMLAttributes<HTMLDivElement> & Testimonial;

const TestimonialCard = ({
  quote,
  location,
  className,
  ...props
}: TestimonialCardProps) => (
  <div
    {...props}
    className={`relative mb-4 break-inside-avoid-column rounded-2xl border border-black/10 bg-white/90 p-5 shadow-drop transition hover:-translate-y-1 hover:border-black/25 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/30 ${className ?? ""}`}
  >
    <div className="space-y-4">
      <Text className="text-base leading-relaxed text-black/70 dark:text-white/70">
        &quot;{quote}&quot;
      </Text>
      <div className="flex items-center justify-end">
        <Text className="text-sm font-semibold text-black dark:text-white">
          — Ryan from {location}
        </Text>
      </div>
    </div>
  </div>
);

export { TestimonialCard };
