"use client";

import Link from "next/link";
import { useState } from "react";
import { Breadcrumbs, Card, Heading, Pill } from "@ryanmeetup/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiUser,
  FiZap,
} from "react-icons/fi";
import { WorkspacePageShell } from "@/components/global";
import { withAccessPreview } from "@/lib/access/access-preview";
import { changelogReleasePath, type ChangelogRelease } from "@/lib/changelog";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

export function ChangelogEntryPageClient({
  initialData,
  demoMode,
  release,
  changelog,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  release: ChangelogRelease;
  changelog: ChangelogRelease[];
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const releaseIndex = changelog.findIndex(
    (candidate) => candidate.slug === release.slug,
  );
  const newerRelease = releaseIndex > 0 ? changelog[releaseIndex - 1] : null;
  const olderRelease =
    releaseIndex < changelog.length - 1 ? changelog[releaseIndex + 1] : null;

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
      <article className="relative mx-auto max-w-4xl">
        <Breadcrumbs
          variant="compact"
          crumbs={[
            {
              href: withAccessPreview("/changelog", data.accessPreview),
              icon: <FiZap aria-hidden />,
              title: "Changelog",
            },
            {
              href: withAccessPreview(
                changelogReleasePath(release),
                data.accessPreview,
              ),
              icon: <FiBookOpen aria-hidden />,
              title: release.version,
              current: true,
            },
          ]}
        />

        <header className="mt-6 border-b border-black/10 pb-8 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              size="sm"
              className="!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-800 dark:!text-emerald-200"
            >
              {release.version}
            </Pill>
            {release.prerelease && (
              <Pill
                size="sm"
                className="!border-amber-500/30 !bg-amber-500/10 !text-amber-800 dark:!text-amber-200"
              >
                Beta
              </Pill>
            )}
          </div>
          <Heading size="h1" bold className="mt-4 text-4xl sm:text-5xl">
            {release.title}
          </Heading>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <time
              dateTime={release.date}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-black/60 dark:text-white/60"
            >
              <FiCalendar
                aria-hidden
                className="text-black/40 dark:text-white/40"
              />
              {release.dateLabel}
            </time>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-black/60 dark:text-white/60">
              <FiUser
                aria-hidden
                className="text-black/40 dark:text-white/40"
              />
              {release.author}
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-7 text-black/65 dark:text-white/65 sm:text-lg">
            {release.summary}
          </p>
        </header>

        <section className="py-8" aria-labelledby="developments-heading">
          <h2 id="developments-heading" className="text-xl font-semibold">
            Major developments
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {release.overview.map((development) => (
              <li
                key={development}
                className="flex items-start gap-3 rounded-xl border border-black/10 bg-white/60 p-4 text-sm text-black/75 dark:border-white/10 dark:bg-white/[0.035] dark:text-white/75"
              >
                <FiCheck
                  aria-hidden
                  className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                />
                {development}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="sr-only">
            Release details
          </h2>
          <Card size="none" className="bg-white/90 dark:bg-white/[0.055]">
            <div className="p-5 sm:p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => (
                    <h2 className="mb-4 mt-8 w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-caps-tight text-emerald-800 first:mt-0 dark:text-emerald-200">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mt-5 text-base font-semibold first:mt-0">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mt-1 text-sm leading-6 text-black/60 dark:text-white/60">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-black/70 dark:text-white/70">
                      {children}
                    </ul>
                  ),
                }}
              >
                {release.content}
              </ReactMarkdown>
            </div>
          </Card>
        </section>

        <nav
          aria-label="Changelog releases"
          className="mt-10 grid gap-3 border-t border-black/10 pt-6 dark:border-white/10 sm:grid-cols-2"
        >
          {olderRelease ? (
            <Link
              href={withAccessPreview(
                changelogReleasePath(olderRelease),
                data.accessPreview,
              )}
              className="group rounded-xl border border-black/10 bg-white/60 p-4 transition hover:border-black/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07] dark:focus-visible:ring-white/40"
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-caps-tight text-black/45 dark:text-white/45">
                <FiArrowLeft aria-hidden /> Previous release
              </span>
              <span className="mt-2 block text-sm font-semibold group-hover:underline">
                {olderRelease.version}: {olderRelease.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {newerRelease && (
            <Link
              href={withAccessPreview(
                changelogReleasePath(newerRelease),
                data.accessPreview,
              )}
              className="group rounded-xl border border-black/10 bg-white/60 p-4 text-right transition hover:border-black/25 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25 dark:hover:bg-white/[0.07] dark:focus-visible:ring-white/40"
            >
              <span className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-caps-tight text-black/45 dark:text-white/45">
                Next release <FiArrowRight aria-hidden />
              </span>
              <span className="mt-2 block text-sm font-semibold group-hover:underline">
                {newerRelease.version}: {newerRelease.title}
              </span>
            </Link>
          )}
        </nav>
      </article>
    </WorkspacePageShell>
  );
}
