"use client";

import type { ReactNode } from "react";
import { Button, Modal } from "@ryanmeetup/ui";
import type { RydSubmission, RydSubmitter } from "@/lib/ryd/matching";
import { rydResponseEvidence } from "@/lib/ryd/submission-view";
import { RydEvidenceFiles, RydSubmissionCard } from "./RydSubmissionCard";

/** Every response stays intact; repeated uploads remain linked to their response. */
export function RydResponseCards({
  submissions,
  footer,
  complete = false,
}: {
  submissions: RydSubmission[];
  footer?: (submission: RydSubmission) => ReactNode;
  complete?: boolean;
}) {
  return rydResponseEvidence(submissions).map(
    ({ submission, preview, repeated }) => (
      <RydSubmissionCard
        key={submission.key}
        submission={submission}
        showFullSocialAnswer={complete}
        evidence={
          <>
            <RydEvidenceFiles fileIds={preview} />
            {repeated.length > 0 && (
              <div className="mt-4 text-sm text-black/70 dark:text-white/70">
                Also uploaded in an earlier response shown here:
                <RydEvidenceFiles fileIds={repeated} links />
              </div>
            )}
          </>
        }
        footer={footer?.(submission)}
      />
    ),
  );
}

export function RydSubmissionDetails({
  submitter,
  onClose,
}: {
  submitter: RydSubmitter;
  onClose: () => void;
}) {
  const name =
    submitter.submissions.find((submission) => submission.legalName)
      ?.legalName ||
    submitter.email ||
    "No name given";
  return (
    <Modal
      open
      setIsOpen={(open) => !open && onClose()}
      title={
        <span className="line-clamp-2 wrap-anywhere">
          Responses from {name}
        </span>
      }
      description={`${submitter.submissions.length} form response${submitter.submissions.length === 1 ? "" : "s"}, with every uploaded file and answer.`}
      size="lg"
      dismissOnOutsideClick
      actions={
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onClose}
        >
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <RydResponseCards submissions={submitter.submissions} complete />
      </div>
    </Modal>
  );
}
