import type { RydSubmission, RydSubmitter } from "./matching";

/** Keep the first occurrence, so repeated uploads have one thumbnail and key. */
export function rydSubmissionFileIds(
  submissions: Pick<RydSubmission, "fileIds">[],
) {
  return [...new Set(submissions.flatMap((submission) => submission.fileIds))];
}

/** Preserve each response's file references without previewing a shared file twice. */
export function rydResponseEvidence(submissions: RydSubmission[]) {
  const shown = new Set<string>();
  return submissions.map((submission) => {
    const preview: string[] = [];
    const repeated: string[] = [];
    for (const id of rydSubmissionFileIds([submission])) {
      if (shown.has(id)) repeated.push(id);
      else {
        preview.push(id);
        shown.add(id);
      }
    }
    return { submission, preview, repeated };
  });
}

export function rydSubmitterSearchText(submitter: RydSubmitter) {
  return [
    submitter.email,
    ...submitter.submissions.flatMap((submission) => [
      submission.legalName,
      submission.email,
      submission.submittedAt,
      submission.socialText,
      ...submission.socialLinks.flatMap((link) => [link.label, link.url]),
      ...submission.otherAnswers.flatMap((entry) => [
        entry.question,
        entry.answer,
      ]),
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

/** Stable across refreshed Google response ordering, including tied/missing dates. */
export function sortRydSubmitters(submitters: RydSubmitter[]) {
  return submitters
    .map((submitter) => ({
      submitter,
      latest: submitter.submissions.reduce(
        (latest, submission) =>
          Math.max(latest, Date.parse(submission.submittedAtIso) || 0),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.latest - a.latest || a.submitter.key.localeCompare(b.submitter.key),
    )
    .map(({ submitter }) => submitter);
}
