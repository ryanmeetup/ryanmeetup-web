import type { ReactNode } from "react";
import { Heading } from "@ryanmeetup/ui";

export function FormSection({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-t border-black/10 pt-5 dark:border-white/10 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.03] text-black/60 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/60"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Heading size="h3" className="text-section-title">
            {title}
          </Heading>
          {description && (
            <p className="mt-1 text-secondary text-black/55 dark:text-white/55">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
