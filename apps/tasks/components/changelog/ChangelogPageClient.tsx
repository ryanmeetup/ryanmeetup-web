"use client";

import Link from "next/link";
import { useState } from "react";
import { Breadcrumbs, Card, Heading, Pill } from "@ryanmeetup/ui";
import {
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiHome,
  FiUser,
  FiZap,
} from "react-icons/fi";
import { WorkspacePageShell } from "@/components/global";
import { withAccessPreview } from "@/lib/access/access-preview";
import { changelogReleasePath, type ChangelogRelease } from "@/lib/changelog";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function ChangelogPageClient({
  initialData,
  demoMode,
  changelog,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  changelog: ChangelogRelease[];
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [latestRelease] = changelog;

  return (
    <WorkspacePageShell
      data={data}
      setData={setData}
      demoMode={demoMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      contentClassName="relative overflow-hidden p-4 sm:p-6 lg:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-8 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl dark:bg-emerald-300/[0.06]"
      />
      <div className="relative mx-auto max-w-5xl">
        <Breadcrumbs
          variant="compact"
          crumbs={[
            {
              href: withAccessPreview("/", data.accessPreview),
              icon: <FiHome aria-hidden />,
              title: "Dashboard",
            },
            {
              href: withAccessPreview("/changelog", data.accessPreview),
              icon: <FiZap aria-hidden />,
              title: "Changelog",
              current: true,
            },
          ]}
        />
        <header className="mb-10 mt-6 border-b border-black/10 pb-8 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              size="sm"
              className="!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-800 dark:!text-emerald-200"
            >
              <FiZap className="mr-2" aria-hidden /> What&apos;s new
            </Pill>
            {latestRelease?.prerelease && (
              <Pill
                size="sm"
                className="!border-amber-500/30 !bg-amber-500/10 !text-amber-800 dark:!text-amber-200"
              >
                Beta
              </Pill>
            )}
          </div>
          <Heading size="h1" bold className="mt-4 text-4xl sm:text-5xl">
            Changelog
          </Heading>
          <p className="mt-3 text-sm leading-6 text-black/65 dark:text-white/65 sm:text-base">
            A build log, not a claim of stability. Feature milestones advance
            the 0.x.0 series, while contained fixes and polish advance 0.x.y.
            This app is in beta, and v1.0.0 is reserved for the deliberate
            production-readiness release. Until then anything can change,
            break, or be replaced. Each entry records what shipped, the
            engineering underneath it, and what is still rough.
          </p>
        </header>

        <ol className="space-y-8">
          {changelog.map((release, releaseIndex) => (
            <li
              key={release.version}
              className="sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8"
            >
              <div className="mb-3 sm:mb-0">
                <span className="block font-cooper text-3xl uppercase">
                  {release.version}
                </span>
                <time
                  dateTime={release.date}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium leading-5 text-black/55 dark:text-white/55"
                >
                  <FiCalendar
                    aria-hidden
                    className="shrink-0 text-black/35 dark:text-white/35"
                  />
                  {release.dateLabel}
                </time>
                <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-black/55 dark:text-white/55">
                  <FiUser
                    aria-hidden
                    className="shrink-0 text-black/35 dark:text-white/35"
                  />
                  {release.author}
                </span>
                {releaseIndex === 0 && (
                  <span className="mt-2 block text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Latest release
                  </span>
                )}
              </div>

              <Link
                href={withAccessPreview(
                  changelogReleasePath(release),
                  data.accessPreview,
                )}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1f2ef] dark:focus-visible:ring-white/50 dark:focus-visible:ring-offset-[#101010]"
              >
                <Card
                  size="none"
                  className="overflow-hidden bg-white/90 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-black/20 group-hover:shadow-md motion-reduce:transform-none dark:bg-white/[0.055] dark:group-hover:border-white/20"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold group-hover:underline sm:text-2xl">
                          {release.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-black/65 dark:text-white/65">
                          {release.summary}
                        </p>
                      </div>
                      <FiArrowRight
                        aria-hidden
                        className="mt-1 shrink-0 text-black/35 transition-transform group-hover:translate-x-1 dark:text-white/35"
                      />
                    </div>
                    <ul className="mt-5 grid gap-2 border-t border-black/10 pt-5 dark:border-white/10 sm:grid-cols-2">
                      {release.overview.map((development) => (
                        <li
                          key={development}
                          className="flex items-start gap-2 text-sm text-black/70 dark:text-white/70"
                        >
                          <FiCheck
                            aria-hidden
                            className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                          />
                          {development}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </WorkspacePageShell>
  );
}
