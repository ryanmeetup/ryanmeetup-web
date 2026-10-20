"use client";

import { useState, type ReactNode } from "react";
import {
  FiClock,
  FiExternalLink,
  FiFacebook,
  FiFile,
  FiGlobe,
  FiInstagram,
  FiLinkedin,
  FiMail,
  FiTwitter,
} from "react-icons/fi";
import { Spinner } from "@ryanmeetup/ui";
import type { RydSubmission } from "@/lib/ryd/matching";
import type { SocialLink } from "@/lib/ryd/normalize";

export const PLATFORM_ICONS: Record<SocialLink["platform"], ReactNode> = {
  instagram: <FiInstagram aria-hidden />,
  facebook: <FiFacebook aria-hidden />,
  linkedin: <FiLinkedin aria-hidden />,
  x: <FiTwitter aria-hidden />,
  tiktok: <FiGlobe aria-hidden />,
  web: <FiGlobe aria-hidden />,
};

/** What's left of the social answer once its links are taken out. */
export function noteText(text: string) {
  const rest = text
    .replace(/\S*(?:https?:\/\/|www\.|\.com|\.net|\.org)\S*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return rest.length >= 12 ? text.trim() : null;
}

/**
 * A thumbnail for an uploaded file. The proxy serves images and PDFs, and only
 * the image ones render in an `<img>`, so a file that fails to load as an
 * image falls back to a plain file tile; both open the file in a new tab.
 * Files come through Google per request and can take a moment, so the tile
 * spins until the image arrives rather than sitting there blank.
 *
 * Not `next/image`: the file is private, streamed per request with the
 * reviewer's session, and must never land in the shared optimizer cache.
 */
export function EvidenceTile({
  fileId,
  index,
}: {
  fileId: string;
  index: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const href = `/api/ryd/evidence/${encodeURIComponent(fileId)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open uploaded file ${index + 1} in a new tab`}
      className="group relative block aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/[0.06] dark:focus-visible:ring-white/40"
    >
      {failed ? (
        <span className="flex h-full flex-col items-center justify-center gap-2 text-xs font-semibold text-black/60 dark:text-white/60">
          <FiFile aria-hidden className="text-xl" />
          File {index + 1}
        </span>
      ) : (
        <>
          {!loaded && (
            <span className="absolute inset-0 flex items-center justify-center text-black/50 dark:text-white/55">
              <Spinner size={22} label={`Loading uploaded file ${index + 1}`} />
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            // A cached image can finish before React attaches onLoad.
            ref={(img) => {
              if (img?.complete && img.naturalWidth) setLoaded(true);
            }}
            src={href}
            alt={`Uploaded file ${index + 1}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition duration-300 group-hover:opacity-90 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      )}
    </a>
  );
}

export function RydSubmissionCard({
  submission,
  action,
}: {
  submission: RydSubmission;
  action?: ReactNode;
}) {
  const note = noteText(submission.socialText);
  return (
    <article className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {submission.legalName || "No name given"}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-black/70 dark:text-white/70">
            <span className="inline-flex min-w-0 items-center gap-1.5 break-all">
              <FiMail aria-hidden className="shrink-0" />
              <span className="sr-only">Email</span>
              {submission.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden className="shrink-0" />
              <span className="sr-only">Sent</span>
              {submission.submittedAt}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      </div>

      {submission.fileIds.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {submission.fileIds.map((fileId, index) => (
            <EvidenceTile key={fileId} fileId={fileId} index={index} />
          ))}
        </div>
      )}

      {submission.socialLinks.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Social links">
          {submission.socialLinks.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/75 transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white/75 dark:hover:border-white/30 dark:focus-visible:ring-white/40"
              >
                {PLATFORM_ICONS[link.platform]}
                {link.label}
                <FiExternalLink aria-hidden className="opacity-60" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <blockquote className="mt-4 whitespace-pre-line border-l-2 border-black/15 pl-3 text-sm text-black/70 dark:border-white/15 dark:text-white/70">
          {note}
        </blockquote>
      )}

      {submission.otherAnswers.length > 0 && (
        <dl className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          {submission.otherAnswers.map((entry) => (
            <div key={entry.question}>
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-black/60 dark:text-white/60">
                {entry.question}
              </dt>
              <dd className="mt-1 whitespace-pre-line break-words text-sm">
                {entry.answer}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!submission.fileIds.length &&
        !submission.socialLinks.length &&
        !note &&
        !submission.otherAnswers.length && (
          <p className="mt-3 text-sm text-black/70 dark:text-white/70">
            No files, links, or other answers in this submission.
          </p>
        )}
    </article>
  );
}
