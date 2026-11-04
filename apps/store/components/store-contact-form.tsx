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

type StoreContactFields = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  orderNumber: string;
  orderEmail: string;
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
  resolution: "information",
  message: "",
};

const topics = [
  { label: "Order status", value: "order-status" },
  { label: "Change or cancel an order", value: "change-order" },
  { label: "Damaged or incorrect item", value: "item-problem" },
  { label: "Refund question", value: "return-refund" },
  { label: "Product or sizing question", value: "product-question" },
  { label: "Something else", value: "other" },
];

const resolutions = [
  { label: "Information or an update", value: "information" },
  { label: "Change my order", value: "change" },
  { label: "Replacement item", value: "replacement" },
  { label: "A refund", value: "return-refund" },
  { label: "Not sure yet", value: "unsure" },
];

export function StoreContactForm() {
  const [fields, setFields] = useState(initialFields);
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const topic = topics.find((option) => option.value === fields.topic)?.label ?? fields.topic;
    const resolution = resolutions.find((option) => option.value === fields.resolution)?.label ?? fields.resolution;
    const orderReference = fields.orderNumber.trim() || "Not provided";

    try {
      await sendContactMessage({
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
          "Ryan General Store customer service request",
          "",
          `Topic: ${topic}`,
          `Order number: ${orderReference}`,
          `Email used for order: ${fields.orderEmail.trim() || "Same as contact email"}`,
          `Preferred resolution: ${resolution}`,
          "",
          "Customer message:",
          fields.message,
        ].join("\n"),
      });
      setFields(initialFields);
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
        <DropdownSelect label="Preferred resolution" variant="field" required value={fields.resolution} onChange={(resolution) => setField("resolution", resolution)} options={resolutions} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Order number" name="orderNumber" placeholder="#RM-1234" value={fields.orderNumber} onChange={update("orderNumber")} />
        <Input label="Email used for the order" name="orderEmail" type="email" placeholder="If different from above" value={fields.orderEmail} onChange={update("orderEmail")} />
      </div>

      <Textarea id="message" label="How can we help?" name="message" placeholder="Tell us what happened and what would make it right." required rows={7} value={fields.message} onChange={update("message")} />

      {status === "success" && (
        <SuccessCallout>Message sent. A Ryan will follow up by email.</SuccessCallout>
      )}
      {status === "error" && <ErrorCallout>{errorMessage}</ErrorCallout>}

      <FormActions>
        <Button type="submit" size="md" leftIcon={<FiSend aria-hidden />} loading={status === "sending"} loadingText="Sending..." className="w-full sm:w-auto sm:min-w-48">
          Send to customer service
        </Button>
      </FormActions>
    </form>
  );
}
