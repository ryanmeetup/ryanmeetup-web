import type { RydSubmission } from "./matching";
import { isRydContactEmail, normalizeEmail, parseSocialLinks } from "./normalize";

/**
 * The RY-dentification form, read through the Google Forms API.
 *
 * Question IDs survive reordering, while titles can change. Identity questions
 * need a unique, recognizable title; ambiguous questions stay as extra answers.
 * Every upload contributes files, and unrecognized questions are still shown
 * to the reviewer, so adding a question never hides what people wrote.
 */

export type GoogleFormItem = {
  title?: string;
  questionItem?: {
    question?: {
      questionId?: string;
      fileUploadQuestion?: object;
      textQuestion?: object;
      choiceQuestion?: object;
      dateQuestion?: object;
      timeQuestion?: object;
      scaleQuestion?: object;
      ratingQuestion?: object;
    };
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

const EMAIL_QUESTION = /\be[\s-]?mail\b/i;
const NAME_QUESTION = /\b(?:legal|full)\s+name\b|^(?:(?:what(?:'s| is)\s+)?your\s+)?name[?*]?$/i;
const OTHER_IDENTITY = /\b(?:company|business|organization|organisation|employer|school|buyer|billing|purchaser|parent|guardian|nickname|username|display)\b/i;
const SOCIAL_QUESTION = /\b(?:social|instagram|facebook|linkedin|profile|links?)\b/i;

/** Ambiguous identity answers are retained for review, never chosen by order. */
export function inspectRydForm(form: GoogleForm) {
  const questions: Question[] = [];
  for (const item of form.items ?? []) {
    const title = item.title?.trim() ?? "";
    const question = item.questionItem?.question;
    if (question?.questionId) {
      let role: Role = question.fileUploadQuestion ? "files" : "other";
      const nonText =
        question.choiceQuestion || question.dateQuestion ||
        question.timeQuestion || question.scaleQuestion || question.ratingQuestion;
      if (role === "other" && !nonText) {
        if (EMAIL_QUESTION.test(title)) role = "email";
        else if (NAME_QUESTION.test(title) && !OTHER_IDENTITY.test(title))
          role = "legalName";
        else if (SOCIAL_QUESTION.test(title)) role = "social";
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
  const warnings: string[] = [];
  const counts = {
    legalName: questions.filter((question) => question.role === "legalName").length,
    email: questions.filter((question) => question.role === "email").length,
  };
  for (const role of ["legalName", "email"] as const) {
    const label = role === "legalName" ? "legal-name" : "email";
    if (counts[role] > 1) {
      warnings.push(
        `The form has ${counts[role]} possible ${label} questions. None is used for matching; all answers remain available for manual review. Keep one clearly titled ${label} question and rename the others.`,
      );
      for (const question of questions)
        if (question.role === role) question.role = "other";
    } else if (!counts[role]) {
      warnings.push(
        role === "legalName"
          ? 'The form has no clear legal-name question. Use one text question titled "Legal name" or "Full name"; other answers remain available for manual review.'
          : "The form has no email question. Google-collected addresses are used when available; other responses stay separate for manual review.",
      );
    }
  }
  return { questions, warnings, emailQuestionCount: counts.email };
}

/** Every question on the form, with the job it does for matching. */
export function rydFormQuestions(form: GoogleForm): Question[] {
  return inspectRydForm(form).questions;
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
  const { questions, emailQuestionCount } = inspectRydForm(form);
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
    // A collected sign-in address must never override an ambiguous, blank, or
    // invalid explicit order-email answer: it may identify a different person.
    const emailAnswer = answerFor("email");
    const candidateEmail =
      emailQuestionCount === 0 ? response.respondentEmail ?? "" : emailAnswer;
    const email = isRydContactEmail(candidateEmail)
      ? normalizeEmail(candidateEmail)
      : "";
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
    if (!email && emailAnswer) {
      const question = byRole("email")[0];
      otherAnswers.push({ question: question.title, answer: emailAnswer });
    }

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
