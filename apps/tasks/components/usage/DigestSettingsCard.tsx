"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Heading, Kicker, toast } from "@ryanmeetup/ui";
import { FiCalendar, FiClock, FiInfo, FiLayers, FiSend } from "react-icons/fi";
import type { IconType } from "react-icons";
import {
  DIGEST_SECTION_META,
  describeCadence,
  nextDigestRun,
  type DigestSettings,
} from "@/lib/digest/digest-settings";
import { runDigestNow } from "@/lib/usage/digest-client";
import { DigestCadenceModal } from "./DigestCadenceModal";
import { DigestStructureModal } from "./DigestStructureModal";
import { errorMessage } from "@/lib/presentation";
import { formatTimestamp } from "@/lib/date-format";

function Detail({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: IconType;
  label: string;
  className?: string;
  children: string;
}) {
  return (
    <div
      className={`flex min-w-0 gap-3 rounded-xl border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035] ${className ?? ""}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-black/65 dark:bg-white/10 dark:text-white/70">
        <Icon aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <dt className="text-[10px] font-semibold uppercase tracking-caps-tight text-black/50 dark:text-white/50">
          {label}
        </dt>
        <dd className="mt-1 text-sm font-semibold leading-relaxed">
          {children}
        </dd>
      </div>
    </div>
  );
}

export function DigestSettingsCard({
  settings,
  setSettings,
  demoMode,
}: {
  settings: DigestSettings;
  setSettings: (settings: DigestSettings) => void;
  demoMode: boolean;
}) {
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [, startRefresh] = useTransition();
  const router = useRouter();

  const next = nextDigestRun(settings, new Date());

  const sendNow = async () => {
    if (demoMode) {
      toast.success("Demo mode does not send email.");
      return;
    }
    setSending(true);
    try {
      const result = await runDigestNow();
      if (result.outcome === "sent")
        toast.success(
          `Scheduled ${result.scheduled} digest${result.scheduled === 1 ? "" : "s"} for ${formatTimestamp(result.deliverAt!)}.`,
        );
      else if (result.outcome === "empty")
        toast.success("Nobody has actionable work right now, so nothing sent.");
      else if (result.outcome === "off_schedule")
        toast.error(
          result.detail ?? "A digest has already gone out for today.",
        );
      else toast.error(result.detail ?? "The digest could not be sent.");
      startRefresh(() => router.refresh());
    } catch (error) {
      toast.error(errorMessage(error, "The digest could not be run."));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card variant="solid" size="none" className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-xl text-white shadow-sm dark:bg-white dark:text-black sm:flex">
                <FiSend aria-hidden />
              </span>
              <div className="min-w-0">
                <Kicker>Workload digest</Kicker>
                <Heading size="h3" className="mt-2 text-2xl sm:text-3xl">
                  {describeCadence(settings)}
                </Heading>
                <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                  A scheduled snapshot of the work that needs attention.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-caps-tight ${
                settings.enabled
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-100"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  settings.enabled ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {settings.enabled ? "Active" : "Paused"}
            </span>
          </div>

          <dl className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.35fr]">
            <Detail icon={FiCalendar} label="Next send">
              {next ? formatTimestamp(next) : "Not scheduled"}
            </Detail>
            <Detail icon={FiClock} label="Review window">
              {`${settings.reviewMinutes} minutes before delivery`}
            </Detail>
            <Detail
              icon={FiLayers}
              label="Included sections"
              className="md:col-span-2 2xl:col-span-1"
            >
              {settings.sections
                .map((key) => DIGEST_SECTION_META[key].label)
                .join(" · ")}
            </Detail>
          </dl>
        </div>

        <div className="border-t border-black/10 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.025] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<FiClock />}
              onClick={() => setCadenceOpen(true)}
            >
              Edit cadence
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<FiLayers />}
              onClick={() => setStructureOpen(true)}
            >
              Edit structure
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:ml-auto sm:w-auto"
              leftIcon={<FiSend />}
              loading={sending}
              loadingText="Sending..."
              onClick={() => void sendNow()}
            >
              Send now
            </Button>
          </div>
          <p className="mt-4 flex items-start gap-2 text-left text-xs leading-relaxed text-black/55 dark:text-white/55">
            <FiInfo aria-hidden className="mt-0.5 shrink-0 text-sm" />
            <span>
              Changes apply on the worker&apos;s next hourly check. Send now
              skips the schedule, but never sends a second digest on the same
              day.
            </span>
          </p>
        </div>
      </Card>

      <DigestCadenceModal
        open={cadenceOpen}
        setOpen={setCadenceOpen}
        settings={settings}
        demoMode={demoMode}
        onSaved={setSettings}
      />
      <DigestStructureModal
        open={structureOpen}
        setOpen={setStructureOpen}
        settings={settings}
        demoMode={demoMode}
        onSaved={setSettings}
      />
    </>
  );
}
