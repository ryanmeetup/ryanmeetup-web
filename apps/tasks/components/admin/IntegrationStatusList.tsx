"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedCollapse, Button, toast } from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiChevronDown,
  FiCalendar,
  FiClock,
  FiDatabase,
  FiGlobe,
  FiKey,
  FiLink,
  FiMail,
  FiSend,
  FiServer,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import type {
  FactKind,
  IntegrationCheck,
  IntegrationState,
} from "@/lib/server/integration-health";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { IntegrationSetupModal } from "./IntegrationSetupModal";

type Accent = "emerald" | "violet" | "sky" | "indigo" | "amber" | "teal";

/**
 * One accent per integration so the list reads as a set of distinct services
 * rather than a wall of grey. State is carried separately, by the badge.
 */
const accents: Record<Accent, { rail: string; tile: string }> = {
  emerald: {
    rail: "bg-emerald-500/60",
    tile: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  violet: {
    rail: "bg-violet-500/60",
    tile: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  sky: {
    rail: "bg-sky-500/60",
    tile: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  indigo: {
    rail: "bg-indigo-500/60",
    tile: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  amber: {
    rail: "bg-amber-500/60",
    tile: "border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  teal: {
    rail: "bg-teal-500/60",
    tile: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
};

/** Icon and accent per known integration key, with a neutral fallback. */
const identity: Record<string, { icon: IconType; accent: Accent }> = {
  "workspace-foundation": { icon: FiUsers, accent: "emerald" },
  supabase: { icon: FiDatabase, accent: "emerald" },
  "supabase-secret": { icon: FiKey, accent: "violet" },
  "mcp-read": { icon: FiShield, accent: "violet" },
  resend: { icon: FiSend, accent: "sky" },
  "google-calendar": { icon: FiCalendar, accent: "indigo" },
  cron: { icon: FiClock, accent: "teal" },
  "app-url": { icon: FiGlobe, accent: "amber" },
};

const fallbackIdentity = { icon: FiGlobe, accent: "sky" as Accent };

/** What kind of thing each fact line holds, at a glance. */
const factIcon: Record<FactKind, IconType> = {
  host: FiServer,
  secret: FiKey,
  client: FiShield,
  email: FiMail,
  schedule: FiClock,
  accounts: FiUsers,
  origin: FiLink,
};

/** Matches the email status badges on the usage page: tinted pill plus dot. */
const stateStyle: Record<IntegrationState, string> = {
  connected:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  configured:
    "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  disabled:
    "border-black/10 bg-black/5 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60",
  attention:
    "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100",
  missing:
    "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100",
};

const stateLabel: Record<IntegrationState, string> = {
  connected: "Connected",
  configured: "Configured",
  disabled: "Disabled",
  attention: "Needs attention",
  missing: "Not set",
};

/** A missing integration outranks its own accent: the whole row goes amber. */
const missingCard =
  "border-amber-500/30 bg-amber-500/[0.06] dark:border-amber-400/25 dark:bg-amber-500/[0.08]";
const presentCard =
  "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]";

/** The env var (or config file) a value comes from, as a code badge. */
const sourceBadge =
  "shrink-0 rounded-md border border-black/10 bg-black/[0.05] px-2 py-0.5 font-mono text-[11px] text-black/60 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/60";

/**
 * Credential and integration state. Values are masked upstream in
 * `getIntegrationHealth`; no secret reaches this component.
 *
 * Rows collapse to the headline — name, state, and what the integration does.
 * The settings behind each one are reference material for a rotation or a
 * fresh deploy, so they stay folded away until asked for. A failing check
 * keeps its consequence in the header, where it cannot be collapsed out of
 * sight.
 */
export function IntegrationStatusList({
  integrations,
}: {
  integrations: IntegrationCheck[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [repairing, setRepairing] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState<string | null>(null);
  const setupFor = integrations.find(
    (integration) => integration.key === setupKey,
  );

  async function repair(integration: IntegrationCheck) {
    if (!integration.action) return;
    setRepairing(integration.key);
    try {
      await mutate(integration.action.endpoint, { method: "POST" });
      toast.success("Workspace foundation repaired.");
      router.refresh();
    } catch (error) {
      toast.error(
        errorMessage(error, "The workspace foundation could not be repaired."),
      );
    } finally {
      setRepairing(null);
    }
  }

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <>
      <ul className="grid gap-3">
        {integrations.map((integration) => {
          const missing =
            integration.state === "missing" ||
            integration.state === "attention";
          const open = expanded.has(integration.key);
          const panelId = `integration-${integration.key}`;
          const { icon: Icon, accent } =
            identity[integration.key] ?? fallbackIdentity;
          const tone = accents[missing ? "amber" : accent];

          return (
            <li
              key={integration.key}
              className={`relative overflow-hidden rounded-2xl border shadow-sm ${missing ? missingCard : presentCard}`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-1.5 ${tone.rail}`}
              />
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(integration.key)}
                className="flex w-full items-start gap-3 p-4 pl-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:focus-visible:ring-white/30 sm:pl-6"
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone.tile}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{integration.label}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${stateStyle[integration.state]}`}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full bg-current"
                      />
                      {stateLabel[integration.state]}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-black/55 dark:text-white/55">
                    {integration.blurb}
                  </span>
                  {integration.consequence ? (
                    <span className="mt-1.5 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <FiAlertTriangle
                        aria-hidden
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      />
                      {integration.consequence}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-black/40 dark:text-white/40">
                  <span className="hidden sm:inline">
                    {integration.facts.length} setting
                    {integration.facts.length === 1 ? "" : "s"}
                  </span>
                  <FiChevronDown
                    aria-hidden
                    className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              {integration.setup ? (
                <div
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 pl-5 sm:pl-6 ${missing ? "border-amber-500/20 dark:border-amber-400/20" : "border-black/[0.07] dark:border-white/[0.07]"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSetupKey(integration.key)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                      missing
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 focus-visible:ring-amber-500/50 dark:border-amber-400/40 dark:text-amber-100 dark:hover:bg-amber-400/20"
                        : "border-black/15 bg-black/[0.03] text-black/70 hover:bg-black/[0.06] focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
                    }`}
                  >
                    <FiBookOpen aria-hidden className="h-3.5 w-3.5" />
                    How to set this up
                  </button>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {integration.setup.steps.length} step
                    {integration.setup.steps.length === 1 ? "" : "s"}
                    {integration.setup.variables.length
                      ? `, ${integration.setup.variables.length} variable${integration.setup.variables.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
              ) : null}

              <AnimatedCollapse id={panelId} open={open}>
                <dl className="grid grid-cols-[auto_max-content_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1.5 border-t border-black/[0.07] px-4 py-3 pl-5 dark:border-white/[0.07] sm:pl-6">
                  {integration.facts.map((fact) => {
                    const FactIcon = factIcon[fact.kind];
                    return (
                      <div
                        key={`${fact.label}-${fact.source}`}
                        className="contents text-sm"
                      >
                        <FactIcon
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-black/30 dark:text-white/30"
                        />
                        <dt className="whitespace-nowrap text-xs uppercase tracking-[0.12em] text-black/45 dark:text-white/45">
                          {fact.label}
                        </dt>
                        <dd
                          className={
                            fact.value === null
                              ? "text-sm font-medium text-amber-700 dark:text-amber-300"
                              : `min-w-0 break-all ${fact.mono === false ? "text-sm text-black/80 dark:text-white/80" : "font-mono text-[13px] tracking-tight text-black/80 dark:text-white/80"}`
                          }
                        >
                          {fact.value ?? "Not set"}
                        </dd>
                        <code className={`justify-self-end ${sourceBadge}`}>
                          {fact.source}
                        </code>
                      </div>
                    );
                  })}
                  {integration.action ? (
                    <div className="col-span-full pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={repairing === integration.key}
                        onClick={() => repair(integration)}
                      >
                        {repairing === integration.key
                          ? "Repairing…"
                          : integration.action.label}
                      </Button>
                    </div>
                  ) : null}
                </dl>
              </AnimatedCollapse>
            </li>
          );
        })}
      </ul>
      {setupFor ? (
        <IntegrationSetupModal
          integration={setupFor}
          open
          setIsOpen={(next) => {
            if (!next) setSetupKey(null);
          }}
        />
      ) : null}
    </>
  );
}
