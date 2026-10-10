"use client";

import {
  Button,
  DropdownSelect,
  ErrorCallout,
  FieldError,
  FormActions,
  Input,
  RequiredFieldsNote,
  SuccessCallout,
  Text,
  Textarea,
} from "@ryanmeetup/ui";
import { validateEmail } from "@ryanmeetup/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast, { Toaster } from "react-hot-toast";
import { BiMailSend as Send } from "react-icons/bi";
import { sendContactMessage } from "./sendContactMessage";
import {
  buildContactSubject,
  findContactTopic,
  findContactTopicDetail,
  type ContactTopic,
  type ContactTopicDetailOption,
} from "./topics";

export type ContactFormFields = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  detail: string;
  detailNote: string;
  subject: string;
  message: string;
};
export type ContactFormProps = {
  /** Reasons a visitor can pick from, in the order they should be listed. */
  topics: ContactTopic[];
  /** Topic slug from the `topic` query param. */
  initialTopic?: string;
  /** Detail slug from the `detail` query param. */
  initialDetail?: string;
  initialSubject?: string;
  initialMessage?: string;
  /** Page the visitor clicked through from, from the `source` query param. */
  source?: string;
  /** Inbox used for topics that do not name one of their own. */
  defaultRouteTo: string;
  layout?: "compact" | "wide";
  messagePlaceholder?: string;
  topicLabel?: string;
  placeholderLabel?: string;
};

const requiredMessages: Partial<Record<keyof ContactFormFields, string>> = {
  firstName: "Error: must provide a first name",
  lastName: "Error: must provide a last name",
  subject: "Error: must provide a subject",
  message: "Error: must provide a message",
};

const ContactForm = ({
  topics,
  initialTopic = "",
  initialDetail = "",
  initialSubject = "",
  initialMessage = "",
  source = "",
  defaultRouteTo,
  layout = "wide",
  messagePlaceholder = "What Ryan business brings you here?",
  topicLabel = "What can we help with?",
  placeholderLabel = "Choose a reason",
}: ContactFormProps) => {
  const defaultValues = useMemo<ContactFormFields>(() => {
    const topic = findContactTopic(topics, initialTopic);
    const detail = findContactTopicDetail(topic, initialDetail);

    return {
      firstName: "",
      lastName: "",
      email: "",
      topic: topic?.value ?? "",
      detail: detail?.value ?? "",
      detailNote: "",
      subject: initialSubject || buildContactSubject(topic, detail),
      message: initialMessage || detail?.message || topic?.message || "",
    };
  }, [initialDetail, initialMessage, initialSubject, initialTopic, topics]);
  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<ContactFormFields>({ defaultValues });
  const [loading, setLoading] = useState(false);
  // What the topic last wrote into subject/message, so picking another topic
  // can replace its own copy without clobbering anything the visitor typed.
  const seeded = useRef({
    subject: defaultValues.subject,
    message: defaultValues.message,
  });

  useEffect(() => {
    reset(defaultValues);
    seeded.current = {
      subject: defaultValues.subject,
      message: defaultValues.message,
    };
  }, [defaultValues, reset]);

  const selectedTopic = findContactTopic(topics, watch("topic"));
  const detailGroup = selectedTopic?.detail;
  const selectedDetail = findContactTopicDetail(selectedTopic, watch("detail"));
  const followUp = selectedDetail?.followUp;

  const seedFromTopic = (
    topic?: ContactTopic,
    detail?: ContactTopicDetailOption,
  ) => {
    const nextSubject = buildContactSubject(topic, detail);
    const nextMessage = detail?.message ?? topic?.message ?? "";
    const currentSubject = getValues("subject");
    const currentMessage = getValues("message");

    if (currentSubject === "" || currentSubject === seeded.current.subject) {
      setValue("subject", nextSubject);
      if (nextSubject) clearErrors("subject");
    }
    if (currentMessage === "" || currentMessage === seeded.current.message) {
      setValue("message", nextMessage);
      if (nextMessage) clearErrors("message");
    }
    seeded.current = { subject: nextSubject, message: nextMessage };
  };

  // Switching topic or detail drops the follow-up answer along with its error,
  // so a question the visitor can no longer see never blocks the send button.
  const resetDetailNote = () => {
    setValue("detailNote", "");
    clearErrors("detailNote");
  };

  const required = (name: keyof ContactFormFields) => ({
    onBlur: (
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) =>
      event.target.value === ""
        ? setError(name, { message: requiredMessages[name] })
        : clearErrors(name),
  });

  const notifySuccess = () =>
    toast.custom(() => (
      <SuccessCallout className="!bg-emerald-50 shadow-xl dark:!bg-emerald-950">
        <strong className="block">Message sent!</strong>
        <span className="block font-normal">
          Thanks for reaching out. Expect an email back from Ryan soon!
        </span>
      </SuccessCallout>
    ));

  const send = async (form: ContactFormFields) => {
    setLoading(true);
    const topic = findContactTopic(topics, form.topic);
    const detail = findContactTopicDetail(topic, form.detail);
    const detailNote = detail?.followUp ? form.detailNote.trim() : "";
    try {
      await sendContactMessage({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        topic: topic?.label ?? "",
        topicValue: topic?.value ?? "",
        detail: detail?.label ?? "",
        detailValue: detail?.value ?? "",
        detailNote,
        routeTo: detail?.routeTo || topic?.routeTo || defaultRouteTo,
        source,
        subject: form.subject,
        // Lead with the answer so it reaches the inbox whether or not the
        // EmailJS template knows about `detailNote`.
        message:
          detail?.followUp && detailNote
            ? `${detail.followUp.label} ${detailNote}\n\n${form.message}`
            : form.message,
      });
      notifySuccess();
      reset(defaultValues);
      seeded.current = {
        subject: defaultValues.subject,
        message: defaultValues.message,
      };
    } catch (error) {
      toast.custom(
        () => (
          <ErrorCallout className="!bg-red-50 shadow-xl dark:!bg-red-950">
            <strong className="block">Message not sent</strong>
            <span className="block font-normal">
              Please try again. If the problem continues, contact Ryan directly.
            </span>
            {error instanceof Error && error.message ? (
              <span className="mt-1 block text-sm font-normal">
                Details: {error.message}
              </span>
            ) : null}
          </ErrorCallout>
        ),
        { duration: 6000 },
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = layout === "compact" ? "col-span-2 sm:col-span-1" : "";
  const fullClass = layout === "compact" ? "col-span-2" : "2xl:col-span-2";
  // The placeholder is only offered until a reason is picked, so it cannot be
  // reselected once the form has a valid topic.
  const topicOptions = [
    ...(selectedTopic ? [] : [{ label: placeholderLabel, value: "" }]),
    ...topics.map((topic) => ({ label: topic.label, value: topic.value })),
  ];
  return (
    <>
      <form
        onSubmit={handleSubmit(send)}
        className={
          layout === "compact"
            ? "grid w-full grid-cols-2 gap-6"
            : "grid w-full grid-cols-1 gap-6 2xl:grid-cols-2"
        }
      >
        <div className={fullClass}>
          <Controller
            control={control}
            name="topic"
            rules={{ required: "Error: must choose a reason for reaching out" }}
            render={({ field }) => (
              <DropdownSelect
                label={topicLabel}
                variant="field"
                required
                value={field.value}
                options={topicOptions}
                onChange={(value) => {
                  const topic = findContactTopic(topics, value);
                  field.onChange(value);
                  setValue("detail", "");
                  clearErrors("detail");
                  resetDetailNote();
                  seedFromTopic(topic);
                }}
              />
            )}
          />
          <FieldError>{errors.topic?.message}</FieldError>
          {selectedTopic?.description && (
            <Text className="mt-2 text-sm text-black/60 dark:text-white/60">
              {selectedTopic.description}
            </Text>
          )}
        </div>
        {detailGroup && (
          <div className={fullClass}>
            <Controller
              control={control}
              name="detail"
              rules={{
                validate: (value) =>
                  value !== "" || "Error: must choose an option",
              }}
              render={({ field }) => (
                <DropdownSelect
                  label={detailGroup.label}
                  variant="field"
                  required
                  value={field.value}
                  options={[
                    ...(field.value
                      ? []
                      : [{ label: placeholderLabel, value: "" }]),
                    ...detailGroup.options.map((option) => ({
                      label: option.label,
                      value: option.value,
                    })),
                  ]}
                  onChange={(value) => {
                    field.onChange(value);
                    resetDetailNote();
                    seedFromTopic(
                      selectedTopic,
                      findContactTopicDetail(selectedTopic, value),
                    );
                  }}
                />
              )}
            />
            <FieldError>{errors.detail?.message}</FieldError>
          </div>
        )}
        {followUp && (
          <div className={fullClass}>
            <Input
              label={followUp.label}
              placeholder={followUp.placeholder}
              required
              {...register("detailNote", {
                validate: (value, form) =>
                  !findContactTopicDetail(
                    findContactTopic(topics, form.topic),
                    form.detail,
                  )?.followUp ||
                  value.trim() !== "" ||
                  "Error: must fill this in",
                onBlur: (event) =>
                  event.target.value.trim() === ""
                    ? setError("detailNote", {
                        message: "Error: must fill this in",
                      })
                    : clearErrors("detailNote"),
              })}
            />
            <FieldError>{errors.detailNote?.message}</FieldError>
          </div>
        )}
        <div className={fieldClass}>
          <Input
            label="First Name"
            placeholder="Ryan"
            required
            {...register("firstName", required("firstName"))}
          />
        </div>
        <div className={fieldClass}>
          <Input
            label="Last Name"
            placeholder="Smith"
            required
            {...register("lastName", required("lastName"))}
          />
        </div>
        <div className={fieldClass}>
          <Input
            label="Email Address"
            placeholder="ryan@ryanmeetup.com"
            type="email"
            required
            {...register("email", {
              onBlur: (event) =>
                validateEmail(event.target.value)
                  ? clearErrors("email")
                  : setError("email", {
                      message: "Error: invalid email address",
                    }),
            })}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div className={fieldClass}>
          <Input
            label="Subject"
            placeholder="Official Ryan Business"
            required
            {...register("subject", required("subject"))}
          />
        </div>
        <div className={fullClass}>
          <Textarea
            id="message"
            label="Message"
            placeholder={
              selectedDetail?.messagePlaceholder ??
              selectedTopic?.messagePlaceholder ??
              messagePlaceholder
            }
            required
            {...register("message", required("message"))}
          />
        </div>
        <FormActions className={fullClass}>
          <RequiredFieldsNote />
          <Button
            type="submit"
            size="md"
            className="w-full sm:w-auto sm:min-w-[180px]"
            leftIcon={<Send />}
            disabled={loading || Object.keys(errors).length !== 0}
            loading={loading}
            loadingText="Sending..."
          >
            Send
          </Button>
        </FormActions>
      </form>
      <Toaster position="bottom-center" />
    </>
  );
};

export { ContactForm };
