export type ContactTopicFollowUp = {
  /** Label of the required text field shown once the option is picked. */
  label: string;
  placeholder?: string;
};

export type ContactTopicDetailOption = {
  label: string;
  value: string;
  /** Appended to the subject line so the inbox reads "Sponsorship: Event sponsor". */
  subject?: string;
  /** Detail-specific message copy that replaces the broader topic seed. */
  message?: string;
  /** Detail-specific guidance for an otherwise empty message. */
  messagePlaceholder?: string;
  /** Inbox for this option, overriding the topic's. */
  routeTo?: string;
  /** Free-text question asked only when this option is picked. */
  followUp?: ContactTopicFollowUp;
};

export type ContactTopic = {
  /** Slug used in the `topic` query param. */
  value: string;
  /** Label shown in the topic dropdown. */
  label: string;
  /** Subject line seeded when the topic is picked. */
  subject: string;
  /** Helper copy shown under the topic dropdown. */
  description?: string;
  /** Message body seeded when the topic is picked. */
  message?: string;
  /** Placeholder shown in the message box for this topic. */
  messagePlaceholder?: string;
  /** Inbox the email should be routed to, sent to EmailJS as `routeTo`. */
  routeTo?: string;
  /** Second dropdown, rendered only when the topic defines one. */
  detail?: {
    label: string;
    options: ContactTopicDetailOption[];
  };
};

const findContactTopic = (topics: ContactTopic[], value?: string) =>
  value ? topics.find((topic) => topic.value === value) : undefined;

const findContactTopicDetail = (topic?: ContactTopic, value?: string) =>
  value
    ? topic?.detail?.options.find((option) => option.value === value)
    : undefined;

/** Subject line for a topic, suffixed with the detail when one is chosen. */
const buildContactSubject = (
  topic?: ContactTopic,
  detail?: ContactTopicDetailOption,
) => {
  if (!topic) return "";
  const suffix = detail?.subject ?? detail?.label;
  return suffix ? `${topic.subject}: ${suffix}` : topic.subject;
};

export type ContactHrefOptions = {
  /** Preselects the second dropdown. */
  detail?: string;
  /** Where the visitor clicked through from, sent to EmailJS as `source`. */
  source?: string;
  /** Contact route, for apps that do not serve it at `/contact`. */
  path?: string;
  /** Overrides the subject the topic would otherwise seed. */
  subject?: string;
  /** Overrides the message body the topic or detail would otherwise seed. */
  message?: string;
};

/** Link to the contact page with the reason for writing already chosen. */
const buildContactHref = (
  topic: string,
  {
    detail,
    source,
    path = "/contact",
    subject,
    message,
  }: ContactHrefOptions = {},
) => {
  const params = new URLSearchParams({ topic });
  if (detail) params.set("detail", detail);
  if (source) params.set("source", source);
  if (subject) params.set("subject", subject);
  if (message) params.set("message", message);
  return `${path}?${params.toString()}`;
};

export {
  buildContactHref,
  buildContactSubject,
  findContactTopic,
  findContactTopicDetail,
};
