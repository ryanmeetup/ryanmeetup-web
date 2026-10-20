import type { RydSubmission } from "./matching";
import { normalizeEmail, parseSocialLinks } from "./normalize";

/**
 * The RY-dentification form, read through the Google Forms API.
 *
 * The form is the source of truth: one form, one link, forever, but its
 * questions change. So nothing here depends on a question's position or its
 * exact wording. The name, email, and social questions are recognised by what
 * they ask; every upload question contributes files; and any question this
 * code doesn't recognise is still shown to the reviewer as an extra answer,
 * so adding a question to the form never hides what people wrote in it.
 */

export type GoogleFormItem = {
  title?: string;
  questionItem?: {
    question?: { questionId?: string; fileUploadQuestion?: object };
  };
  questionGroupItem?: {
    questions?: { questionId?: string; rowQuestion?: { title?: string } }[];
  };
};

export type GoogleForm = {
  formId?: string;
  info?: { title?: string; documentTitle?: string };
  items?: GoogleFormItem[];
  linkedSheetId?: string;
};

type GoogleAnswer = {
  questionId?: string;
  textAnswers?: { answers?: { value?: string }[] };
  fileUploadAnswers?: {
    answers?: { fileId?: string; fileName?: string; mimeType?: string }[];
  };
};

export type GoogleFormResponse = {
  responseId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers?: Record<string, GoogleAnswer>;
};

type Role = "legalName" | "email" | "social" | "files" | "other";

type Question = { id: string; title: string; role: Role };

const ROLE_PATTERNS: [Exclude<Role, "files" | "other">, RegExp][] = [
  ["email", /e-?mail/i],
  ["legalName", /\bname\b/i],
  ["social", /social|instagram|facebook|linkedin|profile|link/i],
];

/** Every question on the form, with the job it does for matching. */
export function rydFormQuestions(form: GoogleForm): Question[] {
  const questions: Question[] = [];
  const taken = new Set<Role>();
  for (const item of form.items ?? []) {
    const title = item.title?.trim() ?? "";
    const question = item.questionItem?.question;
    if (question?.questionId) {
      let role: Role = question.fileUploadQuestion ? "files" : "other";
      if (role === "other")
        for (const [candidate, pattern] of ROLE_PATTERNS)
          // The first question that asks for each thing claims it; a second
          // "name" question (a nickname, say) is shown as an extra answer.
          if (!taken.has(candidate) && pattern.test(title)) {
            role = candidate;
            taken.add(candidate);
            break;
          }
      questions.push({ id: question.questionId, title, role });
    }
    for (const row of item.questionGroupItem?.questions ?? [])
      if (row.questionId)
        questions.push({
          id: row.questionId,
          title: [title, row.rowQuestion?.title].filter(Boolean).join(" — "),
          role: "other",
        });
  }
  return questions;
}

const text = (answer: GoogleAnswer | undefined) =>
  (answer?.textAnswers?.answers ?? [])
    .map((entry) => entry.value?.trim() ?? "")
    .filter(Boolean)
    .join(", ");

/** "10/15/2026 12:03 AM" in the workspace's zone, for reading at a glance. */
export function formatRydSubmittedAt(
  iso: string,
  timeZone = "America/New_York",
) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** A day alone, "Oct 18", in the same zone as `formatRydSubmittedAt`. */
export function formatRydDay(iso: string, timeZone = "America/New_York") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function parseRydFormResponses(
  form: GoogleForm,
  responses: GoogleFormResponse[],
): RydSubmission[] {
  const questions = rydFormQuestions(form);
  const byRole = (role: Role) => questions.filter((q) => q.role === role);
  const submissions: RydSubmission[] = [];

  for (const response of responses) {
    if (!response.responseId) continue;
    const answers = response.answers ?? {};
    const answerFor = (role: Role) =>
      byRole(role)
        .map((q) => text(answers[q.id]))
        .filter(Boolean)
        .join("\n");
    // A form set to collect addresses records the signed-in email itself;
    // otherwise the address is whatever the email question says.
    const email = normalizeEmail(
      answerFor("email") || response.respondentEmail || "",
    );
    const submittedAtIso =
      response.lastSubmittedTime ?? response.createTime ?? "";
    const socialText = answerFor("social");
    const fileIds = byRole("files").flatMap((q) =>
      (answers[q.id]?.fileUploadAnswers?.answers ?? [])
        .map((file) => file.fileId)
        .filter((id): id is string => Boolean(id)),
    );
    const otherAnswers = byRole("other")
      .map((q) => ({ question: q.title, answer: text(answers[q.id]) }))
      .filter((entry) => entry.answer);

    submissions.push({
      // The response ID survives the respondent editing their answers, and
      // doesn't depend on the email they typed.
      key: response.responseId,
      submittedAt: submittedAtIso ? formatRydSubmittedAt(submittedAtIso) : "",
      submittedAtIso,
      legalName: answerFor("legalName").replace(/\s+/g, " "),
      email,
      fileIds: [...new Set(fileIds)],
      socialText,
      // Handles turn up in any free-text answer, not just the social one.
      socialLinks: parseSocialLinks(
        [socialText, ...otherAnswers.map((entry) => entry.answer)].join("\n"),
      ),
      otherAnswers,
    });
  }
  return submissions;
}

/**
 * Days since 1899-12-30 as the response sheet counts them: wall-clock time in
 * the sheet's own zone. This is how a response is found in the linked sheet,
 * which has no response IDs, to tick its `Verified?` cell.
 */
export function sheetSerial(iso: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, Number(part.value)]),
  );
  const wallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return wallClock / 86_400_000 + 25_569;
}

/** The ID in any link to the form's editor, or the ID itself. */
export function formIdFrom(raw: string) {
  const value = raw.trim();
  // `/forms/d/e/...` is the public link, whose ID the API doesn't accept.
  if (/\/forms\/d\/e\//.test(value)) return null;
  const id = value.match(/\/forms\/d\/([A-Za-z0-9_-]{20,})/)?.[1] ?? value;
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : null;
}
