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
import { rydSubmissionFileIds } from "@/lib/ryd/submission-view";

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

/** A card's action row: a rule above, then controls that wrap on narrow cards. */
export function RydCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/10">
      {children}
    </div>
  );
}

/** Private evidence uses the session-bound proxy in both presentations. */
export function RydEvidenceFiles({
  fileIds,
  links = false,
}: {
  fileIds: string[];
  links?: boolean;
}) {
  const unique = rydSubmissionFileIds([{ fileIds }]);
  if (!unique.length) return null;
  if (links)
    return (
      <ul
        className="mt-2 flex flex-wrap gap-3 text-sm"
        aria-label="Previously shown uploads"
      >
        {unique.map((fileId, index) => (
          <li key={fileId}>
            <a
              href={`/api/ryd/evidence/${encodeURIComponent(fileId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
            >
              <FiFile aria-hidden /> Shared file {index + 1}{" "}
              <FiExternalLink aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {unique.map((fileId, index) => (
        <EvidenceTile key={fileId} fileId={fileId} index={index} />
      ))}
    </div>
  );
}

export function RydSubmissionCard({
  submission,
  badge,
  action,
  footer,
  evidence,
  showFullSocialAnswer = false,
}: {
  submission: RydSubmission;
  /** Sits beside the name, such as how often they've been contacted. */
  badge?: ReactNode;
  action?: ReactNode;
  /** Actions under the evidence, set off by a rule. */
  footer?: ReactNode;
  /** Grouped responses can link back to uploads already previewed above. */
  evidence?: ReactNode;
  showFullSocialAnswer?: boolean;
}) {
  const note = showFullSocialAnswer
    ? submission.socialText.trim()
    : noteText(submission.socialText);
  return (
    <article className="min-w-0 wrap-anywhere rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="wrap-anywhere font-semibold">
              {submission.legalName || "No name given"}
            </p>
            {badge}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-black/70 dark:text-white/70">
            <span className="inline-flex min-w-0 items-center gap-1.5 break-all">
              <FiMail aria-hidden className="shrink-0" />
              <span className="sr-only">Email</span>
              {submission.email || "No email given"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden className="shrink-0" />
              <span className="sr-only">Sent</span>
              {submission.submittedAt}
            </span>
          </p>
        </div>
        {action && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {action}
          </div>
        )}
      </div>

      {evidence ?? <RydEvidenceFiles fileIds={submission.fileIds} />}

      {submission.socialLinks.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Social links">
          {submission.socialLinks.map((link) => (
            <li key={link.url} className="min-w-0 max-w-full">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/75 transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:text-white/75 dark:hover:border-white/30 dark:focus-visible:ring-white/40 [&_svg]:shrink-0"
              >
                {PLATFORM_ICONS[link.platform]}
                <span className="min-w-0 wrap-anywhere">{link.label}</span>
                <FiExternalLink aria-hidden className="opacity-60" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <blockquote className="mt-4 whitespace-pre-line wrap-anywhere border-l-2 border-black/15 pl-3 text-sm text-black/70 dark:border-white/15 dark:text-white/70">
          {note}
        </blockquote>
      )}

      {submission.otherAnswers.length > 0 && (
        <dl className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          {submission.otherAnswers.map((entry, index) => (
            // Question titles may repeat; these parsed answers have no question ID.
            <div key={`${index}:${entry.question}`}>
              <dt className="wrap-anywhere text-xs font-semibold uppercase tracking-[0.16em] text-black/60 dark:text-white/60">
                {entry.question}
              </dt>
              <dd className="mt-1 whitespace-pre-line wrap-anywhere text-sm">
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

      {footer && <RydCardFooter>{footer}</RydCardFooter>}
    </article>
  );
}
