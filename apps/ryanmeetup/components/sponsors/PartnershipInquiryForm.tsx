"use client";

import { track } from "@vercel/analytics";
import {
  Button,
  DropdownSelect,
  ErrorCallout,
  FieldError,
  FormActions,
  Input,
  RequiredFieldsNote,
  SuccessCallout,
  toast,
  Textarea,
} from "@ryanmeetup/ui";
import { sendContactMessage } from "@ryanmeetup/contact";
import { normalizeHttpUrl, validateEmail } from "@ryanmeetup/utils";
import { Controller, useForm } from "react-hook-form";
import { useRef, useState } from "react";
import { BiMailSend as Send } from "react-icons/bi";

import {
  collaborationTypes,
  SPONSORSHIP_INBOX,
} from "@/lib/sponsorship-program";

type PartnershipInquiryFields = {
  integration: string;
  brandName: string;
  firstName: string;
  lastName: string;
  email: string;
  website: string;
  goals: string;
  timing: string;
};

const defaultValues: PartnershipInquiryFields = {
  integration: "",
  brandName: "",
  firstName: "",
  lastName: "",
  email: "",
  website: "",
  goals: "",
  timing: "",
};

const PartnershipInquiryForm = () => {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PartnershipInquiryFields>({ defaultValues });
  const [loading, setLoading] = useState(false);
  const started = useRef(false);

  const noteStarted = () => {
    if (started.current) return;
    started.current = true;
    track("sponsorship_intake_started", { source: "sponsor-partnerships" });
  };

  const send = async (form: PartnershipInquiryFields) => {
    const integration = collaborationTypes.find(
      (item) => item.slug === form.integration,
    );
    const website = normalizeHttpUrl(form.website);
    if (!integration || !website) return;

    setLoading(true);
    try {
      await sendContactMessage({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        topic: "Sponsorships & Partnerships",
        topicValue: "sponsorship",
        detail: integration.name,
        detailValue: integration.slug,
        routeTo: SPONSORSHIP_INBOX,
        source: "sponsor-partnerships-intake",
        subject: `Brand collaboration inquiry: ${form.brandName} — ${integration.shortName}`,
        message: [
          `Brand/company: ${form.brandName}`,
          `Website: ${website}`,
          `Integration: ${integration.name}`,
          `Desired timing: ${form.timing}`,
          "",
          "Campaign goals:",
          form.goals,
        ].join("\n"),
      });

      track("sponsorship_intake_submitted", {
        integration: integration.slug,
      });
      toast.custom(() => (
        <SuccessCallout className="!bg-emerald-50 shadow-xl dark:!bg-emerald-950">
          <strong className="block">Inquiry sent!</strong>
          <span className="block font-normal">
            Thanks for reaching out. A Ryan will review the fit and follow up
            soon.
          </span>
        </SuccessCallout>
      ));
      reset(defaultValues);
      started.current = false;
    } catch (error) {
      toast.custom(
        () => (
          <ErrorCallout className="!bg-red-50 shadow-xl dark:!bg-red-950">
            <strong className="block">Inquiry not sent</strong>
            <span className="block font-normal">
              Please try again. If it still fails, email {SPONSORSHIP_INBOX}
              directly.
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

  return (
    <>
      <form
        onFocus={noteStarted}
        onSubmit={handleSubmit(send)}
        className="space-y-6"
      >
        <div className="grid gap-6 2xl:grid-cols-2">
          <div>
            <Controller
              control={control}
              name="integration"
              rules={{ required: "Choose the kind of collaboration" }}
              render={({ field }) => (
                <DropdownSelect
                  label="Desired integration"
                  variant="field"
                  required
                  value={field.value}
                  options={[
                    ...(field.value
                      ? []
                      : [{ label: "Choose a collaboration type", value: "" }]),
                    ...collaborationTypes.map((item) => ({
                      label: item.name,
                      value: item.slug,
                    })),
                  ]}
                  onChange={(value) => {
                    field.onChange(value);
                    track("sponsorship_integration_selected", {
                      integration: value,
                    });
                  }}
                />
              )}
            />
            <FieldError>{errors.integration?.message}</FieldError>
          </div>

          <div>
            <Input
              label="Desired timing"
              placeholder="Fall 2026, next quarter, or still flexible"
              required
              error={Boolean(errors.timing)}
              {...register("timing", {
                required: "Share the desired timing",
              })}
            />
            <FieldError>{errors.timing?.message}</FieldError>
          </div>
        </div>

        <div className="space-y-6 border-t border-black/10 pt-6 dark:border-white/10">
          <div className="grid gap-6 2xl:grid-cols-2">
            <div>
              <Input
                label="Brand or company name"
                placeholder="Ryan & Sons"
                required
                error={Boolean(errors.brandName)}
                {...register("brandName", {
                  required: "Enter the brand or company name",
                })}
              />
              <FieldError>{errors.brandName?.message}</FieldError>
            </div>
            <div>
              <Input
                label="Brand website"
                placeholder="example.com"
                required
                error={Boolean(errors.website)}
                {...register("website", {
                  required: "Enter the brand website",
                  validate: (value) =>
                    Boolean(normalizeHttpUrl(value)) || "Enter a valid website",
                })}
              />
              <FieldError>{errors.website?.message}</FieldError>
            </div>
            <div>
              <Input
                label="First name"
                placeholder="Ryan"
                required
                error={Boolean(errors.firstName)}
                {...register("firstName", { required: "Enter a first name" })}
              />
              <FieldError>{errors.firstName?.message}</FieldError>
            </div>
            <div>
              <Input
                label="Last name"
                placeholder="Smith"
                required
                error={Boolean(errors.lastName)}
                {...register("lastName", { required: "Enter a last name" })}
              />
              <FieldError>{errors.lastName?.message}</FieldError>
            </div>
            <div className="2xl:col-span-2">
              <Input
                label="Work email"
                placeholder="ryan@example.com"
                type="email"
                required
                error={Boolean(errors.email)}
                {...register("email", {
                  required: "Enter a work email",
                  validate: (value) =>
                    validateEmail(value) || "Enter a valid email address",
                })}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
          </div>

          <div>
            <Textarea
              id="sponsorship-goals"
              label="What do you want to build?"
              placeholder="Tell us the idea, the goal behind it, and what would make it a win for your brand. We will work out the shape and the pricing together."
              rows={7}
              required
              aria-invalid={Boolean(errors.goals) || undefined}
              {...register("goals", {
                required: "Tell us what you want to build",
              })}
            />
            <FieldError>{errors.goals?.message}</FieldError>
          </div>

          <FormActions>
            <RequiredFieldsNote />
            <Button
              type="submit"
              size="md"
              className="w-full sm:w-auto sm:min-w-[220px]"
              aria-label="Send collaboration inquiry"
              leftIcon={<Send />}
              disabled={loading}
              loading={loading}
              loadingText="Sending inquiry..."
            >
              <span aria-hidden className="sm:hidden">
                Send inquiry
              </span>
              <span aria-hidden className="hidden sm:inline">
                Send collaboration inquiry
              </span>
            </Button>
          </FormActions>
        </div>
      </form>
    </>
  );
};

export { PartnershipInquiryForm };
