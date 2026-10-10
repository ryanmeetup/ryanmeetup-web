import emailjs from "@emailjs/browser";

export type ContactMessage = {
  firstName: string;
  lastName: string;
  email: string;
  /** Human label of the chosen topic, e.g. "Sponsorships & partnerships". */
  topic: string;
  /** Topic slug, for filters and routing rules. */
  topicValue: string;
  /** Human label of the follow-up dropdown, empty when the topic has none. */
  detail: string;
  detailValue: string;
  /** Answer to the detail's follow-up question, empty when it asks none. */
  detailNote?: string;
  /** Inbox this topic should land in. Never empty. */
  routeTo: string;
  /** Page the visitor clicked through from, empty when they came in cold. */
  source: string;
  subject: string;
  message: string;
};

const requiredEmailJsSetting = (name: string, value?: string) => {
  const setting = value?.trim();
  if (!setting) {
    throw new Error(`EmailJS is missing ${name}.`);
  }
  return setting;
};

export async function sendContactMessage(message: ContactMessage) {
  if (process.env.NEXT_PUBLIC_E2E_TESTS === "true") {
    return { status: 200, text: "E2E_TEST_MODE" };
  }

  const serviceId = requiredEmailJsSetting(
    "NEXT_PUBLIC_EMAIL_SERVICE_ID",
    process.env.NEXT_PUBLIC_EMAIL_SERVICE_ID,
  );
  const templateId = requiredEmailJsSetting(
    "NEXT_PUBLIC_EMAIL_TEMPLATE_ID",
    process.env.NEXT_PUBLIC_EMAIL_TEMPLATE_ID,
  );
  const publicKey = requiredEmailJsSetting(
    "NEXT_PUBLIC_EMAIL_USER_ID",
    process.env.NEXT_PUBLIC_EMAIL_USER_ID,
  );

  if (!message.routeTo.trim()) {
    throw new Error("EmailJS is missing a destination inbox.");
  }

  const response = await emailjs.send(
    serviceId,
    templateId,
    message,
    publicKey,
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `EmailJS did not accept the message (${response.status} ${response.text}).`,
    );
  }

  return response;
}
