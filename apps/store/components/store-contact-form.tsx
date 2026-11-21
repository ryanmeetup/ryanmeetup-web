"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { FiSend } from "react-icons/fi";
import { sendContactMessage } from "@ryanmeetup/contact";
import {
  Button,
  DropdownSelect,
  ErrorCallout,
  FormActions,
  Input,
  SuccessCallout,
  Textarea,
} from "@ryanmeetup/ui";
import { getAdminOrderSearchUrl, SITE_BUG_TOPIC, type SupportPrefill } from "@/lib/support";

type StoreContactFields = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  orderNumber: string;
  orderEmail: string;
  page: string;
  resolution: string;
  message: string;
};

const initialFields: StoreContactFields = {
  firstName: "",
  lastName: "",
  email: "",
  topic: "order-status",
  orderNumber: "",
  orderEmail: "",
  page: "",
  resolution: "information",
  message: "",
};

// All sales are final, so refunds are never offered as an option. Exceptions still
// reach us through "Damaged or incorrect item", "Something else", and the message.
const topics = [
  { label: "Order status", value: "order-status" },
  { label: "Change or cancel an order", value: "change-order" },
  { label: "Damaged or incorrect item", value: "item-problem" },
  { label: "Product or sizing question", value: "product-question" },
  { label: "Something’s broken on the site", value: SITE_BUG_TOPIC },
  { label: "Something else", value: "other" },
];

const resolutions = [
  { label: "Information or an update", value: "information" },
  { label: "Change my order", value: "change" },
  { label: "Replacement item", value: "replacement" },
  { label: "Not sure yet", value: "unsure" },
];

export function StoreContactForm({ prefill, adminOrdersUrl }: { prefill?: SupportPrefill; adminOrdersUrl?: string | null }) {
  // A link from a Shopify order email fills in the order; the form resets to blank after sending.
  const [fields, setFields] = useState<StoreContactFields>({
    ...initialFields,
    email: prefill?.email ?? "",
    orderNumber: prefill?.order ?? "",
    topic: prefill?.topic || initialFields.topic,
    page: prefill?.page ?? "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const setField = (name: keyof StoreContactFields, value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    if (status !== "idle") setStatus("idle");
  };

  const update =
    (name: keyof StoreContactFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setField(name, event.target.value);
    };

  const isBugReport = fields.topic === SITE_BUG_TOPIC;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    if (isBugReport) {
      await send(sendBugReport);
      return;
    }

    const topic = topics.find((option) => option.value === fields.topic)?.label ?? fields.topic;
    const resolution = resolutions.find((option) => option.value === fields.resolution)?.label ?? fields.resolution;
    const orderReference = fields.orderNumber.trim() || "Not provided";

    await send(() =>
      sendContactMessage({
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
        topic,
        topicValue: fields.topic,
        detail: resolution,
        detailValue: fields.resolution,
        routeTo: "ryan@ryanmeetup.com",
        source: "store-contact",
        subject: `[Store: ${topic}] ${fields.orderNumber.trim() || `${fields.firstName} ${fields.lastName}`}`,
        message: [
          "Ryan Meetup Store customer service request",
          "",
          `Topic: ${topic}`,
          `Order number: ${orderReference}`,
          `Email used for order: ${fields.orderEmail.trim() || "Same as contact email"}`,
          `Preferred resolution: ${resolution}`,
          ...(adminOrdersUrl ? [`Find in Shopify: ${getAdminOrderSearchUrl(adminOrdersUrl, fields.orderNumber, fields.orderEmail || fields.email)}`] : []),
          "",
          "Customer message:",
          fields.message,
        ].join("\n"),
      }),
    );
  };

  // The browser and window size come along automatically, so the visitor only has to
  // describe what happened.
  const sendBugReport = () => {
    const page = fields.page.trim();
    return sendContactMessage({
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      topic: "Site bug",
      topicValue: SITE_BUG_TOPIC,
      detail: "Thank-you coupon if confirmed",
      detailValue: "coupon-if-confirmed",
      routeTo: "ryan@ryanmeetup.com",
      source: "store-bug-report",
      subject: `[Store: Site bug] ${page || `${fields.firstName} ${fields.lastName}`}`,
      message: [
        "Ryan Meetup Store bug report",
        "",
        // A prefilled path becomes a clickable link; anything typed by hand stays as written.
        `Page: ${page.startsWith("/") ? `${window.location.origin}${page}` : page || "Not provided"}`,
        `Browser: ${navigator.userAgent}`,
        `Window: ${window.innerWidth} × ${window.innerHeight}`,
        `Reported: ${new Date().toISOString()}`,
        "",
        "If this bug is confirmed, send the reporter a thank-you coupon.",
        "",
        "What happened:",
        fields.message,
      ].join("\n"),
    });
  };

  const send = async (deliver: () => Promise<unknown>) => {
    try {
      await deliver();
      setFields({ ...initialFields, topic: fields.topic });
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Your message could not be sent. Please try again.");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="First name" name="firstName" placeholder="Ryan" required value={fields.firstName} onChange={update("firstName")} />
        <Input label="Last name" name="lastName" placeholder="Smith" required value={fields.lastName} onChange={update("lastName")} />
      </div>

      <Input label="Contact email" name="email" type="email" placeholder="ryan@example.com" required value={fields.email} onChange={update("email")} />

      <div className="grid gap-6 sm:grid-cols-2">
        <DropdownSelect label="What can we help with?" variant="field" required value={fields.topic} onChange={(topic) => setField("topic", topic)} options={topics} />
        {isBugReport ? (
          <Input label="Page with the problem" name="page" placeholder="The cart, a product page, wherever it happened" value={fields.page} onChange={update("page")} />
        ) : (
          <DropdownSelect label="Preferred resolution" variant="field" required value={fields.resolution} onChange={(resolution) => setField("resolution", resolution)} options={resolutions} />
        )}
      </div>

      {!isBugReport && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Input label="Order number" name="orderNumber" placeholder="#RM-1234" value={fields.orderNumber} onChange={update("orderNumber")} />
          <Input label="Email used for the order" name="orderEmail" type="email" placeholder="If different from above" value={fields.orderEmail} onChange={update("orderEmail")} />
        </div>
      )}

      {isBugReport ? (
        <Textarea id="message" label="What went weird?" name="message" placeholder="What did you click, and what happened instead?" required rows={7} value={fields.message} onChange={update("message")} />
      ) : (
        <Textarea id="message" label="How can we help?" name="message" placeholder="Tell us what happened and what would make it right." required rows={7} value={fields.message} onChange={update("message")} />
      )}

      {status === "success" && (
        <SuccessCallout>
          {isBugReport
            ? "Bug report sent. Nice catch! If we can confirm it, a Ryan will email you a thank-you coupon."
            : "Message sent. A Ryan will follow up by email."}
        </SuccessCallout>
      )}
      {status === "error" && <ErrorCallout>{errorMessage}</ErrorCallout>}

      <FormActions>
        <Button type="submit" size="md" leftIcon={<FiSend aria-hidden />} loading={status === "sending"} loadingText="Sending..." className="w-full sm:w-auto sm:min-w-48">
          {isBugReport ? "Send bug report" : "Send to customer service"}
        </Button>
      </FormActions>
    </form>
  );
}
