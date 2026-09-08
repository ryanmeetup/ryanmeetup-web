"use client";

import { SiteFooter, type SiteFooterLink } from "@ryanmeetup/ui";
import { usePathname } from "next/navigation";
import { InstanceWordmark, useInstance } from "@/components/global";
import { socialIcons, socialLabels } from "@/lib/instance-socials";

const signedOutRoutes = new Set([
  "/forgot-password",
  "/login",
  "/reset-password",
]);

/**
 * Every string in the footer comes from instance settings. Tasks deliberately
 * has one compact footer layout across signed-in, signed-out, and demo views.
 *
 * There are two mount points. `inShell` is the copy inside the workspace
 * chrome, which only exists once the shell itself has rendered; the copy in the
 * root layout covers the signed-out routes, which have no chrome. Splitting
 * them this way is what keeps the footer from painting on its own against an
 * empty page while the workspace layout is still loading its data.
 */
export function TasksFooter({ inShell = false }: { inShell?: boolean }) {
  const instance = useInstance();
  const pathname = usePathname();

  const signedOut =
    signedOutRoutes.has(pathname) || pathname.startsWith("/auth/");
  if (inShell === signedOut || pathname === "/board") return null;

  const socialLinks: SiteFooterLink[] = instance.footerSocials.map(
    ({ platform, url }) => ({
      href: url,
      icon: socialIcons[platform],
      label: socialLabels[platform],
    }),
  );
  return (
    <SiteFooter
      variant="minimal"
      title={instance.name.toUpperCase()}
      wordmark={<InstanceWordmark />}
      subtitle={instance.footerSubtitle}
      className="tasks-footer px-4 sm:px-6 lg:px-8"
      sections={instance.footerSections.map((section) => ({
        title: section.title,
        columns: 2,
        links: section.links.map((link) => ({
          href: link.url,
          label: link.label,
        })),
      }))}
      socialLinks={socialLinks}
      credit={{
        href: instance.creditUrl,
        label: instance.creditLabel,
        prefix: instance.creditPrefix,
        suffix: instance.creditSuffix,
      }}
    />
  );
}
