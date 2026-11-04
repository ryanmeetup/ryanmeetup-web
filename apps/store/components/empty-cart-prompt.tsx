"use client";

import Link from "next/link";
import { Button, Text } from "@ryanmeetup/ui";
import { FiArrowRight, FiShoppingCart } from "react-icons/fi";
import { storeNavigation } from "@/lib/navigation";

const startingPoints = storeNavigation.filter(
  (item): item is Extract<(typeof storeNavigation)[number], { href: string }> =>
    "href" in item && (item.href === "/collections/apparel" || item.href === "/collections/accessories"),
);

/** An empty cart points somewhere worth shopping instead of just saying so. `onNavigate` closes a drawer on the way out. */
export function EmptyCartPrompt({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70" aria-hidden="true">
        <FiShoppingCart className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <div className="space-y-2 text-center">
        <Text className="text-xs font-semibold uppercase tracking-[0.2em]">Your cart is remarkably Ryan-free.</Text>
        <Text>Easily fixed. Every Ryan deserves at least one shirt with their name on it.</Text>
      </div>
      <ul className="space-y-2">
        {startingPoints.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className="group flex items-center gap-4 rounded-2xl border border-black/10 bg-white/70 p-4 transition hover:border-black/20 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10 dark:focus-visible:ring-white/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 dark:border-white/10" aria-hidden>
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-black/70 dark:text-white/70">{description}</span>
              </span>
              <FiArrowRight className="shrink-0 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <Button.Link href="/collections/all" size="md" fullWidth onClick={onNavigate}>Browse the goods</Button.Link>
    </div>
  );
}
