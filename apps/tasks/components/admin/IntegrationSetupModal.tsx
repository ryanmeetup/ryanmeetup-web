"use client";

import { useState } from "react";
import { Modal, ModalActions, toast } from "@ryanmeetup/ui";
import { FiCheck, FiCopy, FiExternalLink } from "react-icons/fi";
import type {
  IntegrationCheck,
  SetupStep,
  SetupVariable,
} from "@/lib/server/integration-health";

/**
 * True for every guide, so it is said once at the top rather than repeated as
 * a final step in each one.
 */
const whereVariablesLive =
  "Every variable below is set on the hosting project — on Vercel, Settings → Environment Variables — and locally in apps/tasks/.env.local. None of them take effect until a fresh deployment is built.";

const codeBlock =
  "overflow-x-auto rounded-lg border border-black/10 bg-black/[0.04] px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre text-black/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80";

/** Copies one line of setup material: a command, a variable name, a path. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`${label} could not be copied.`);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="shrink-0 rounded-md border border-black/10 bg-white/70 p-1.5 text-black/50 transition hover:border-black/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/15 dark:bg-white/[0.06] dark:text-white/50 dark:hover:border-white/40 dark:hover:text-white dark:focus-visible:ring-white/30"
    >
      {copied ? (
        <FiCheck
          aria-hidden
          className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
        />
      ) : (
        <FiCopy aria-hidden className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function Step({ step, index }: { step: SetupStep; index: number }) {
  return (
    <li className="relative pl-10">
      <span
        aria-hidden
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-black/[0.04] text-xs font-semibold text-black/60 dark:border-white/15 dark:bg-white/[0.07] dark:text-white/60"
      >
        {index + 1}
      </span>
      <p className="pt-1 text-sm leading-relaxed text-black/75 dark:text-white/75">
        {step.text}
      </p>
      {step.command ? (
        <div className="mt-2 flex items-start gap-2">
          <pre className={`min-w-0 flex-1 ${codeBlock}`}>{step.command}</pre>
          <CopyButton value={step.command} label="Command" />
        </div>
      ) : null}
      {step.link ? (
        <a
          href={step.link.href}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-black/10 px-2.5 py-1 text-xs font-medium text-black/70 transition hover:border-black/30 hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white"
        >
          {step.link.label}
          <FiExternalLink aria-hidden className="h-3 w-3" />
        </a>
      ) : null}
    </li>
  );
}

function Variable({ variable }: { variable: SetupVariable }) {
  return (
    <li className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center gap-2">
        <code className="min-w-0 break-all font-mono text-[13px] font-semibold text-black/85 dark:text-white/85">
          {variable.name}
        </code>
        <span className="ml-auto">
          <CopyButton value={variable.name} label={variable.name} />
        </span>
      </div>
      <p className="mt-1 break-all font-mono text-[12px] text-black/50 dark:text-white/50">
        {variable.example}
      </p>
      {variable.note ? (
        <p className="mt-1 text-xs text-black/55 dark:text-white/55">
          {variable.note}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The full procedure for one unconfigured integration: what to do, in order,
 * and the variables it ends by setting. Read-only — the values themselves live
 * in the hosting environment, never in this app.
 */
export function IntegrationSetupModal({
  integration,
  open,
  setIsOpen,
}: {
  integration: IntegrationCheck;
  open: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const setup = integration.setup;
  if (!setup) return null;

  return (
    <Modal
      open={open}
      setIsOpen={setIsOpen}
      dismissOnOutsideClick
      size="lg"
      title={`Set up ${integration.label}`}
      description={setup.summary}
      actions={
        <ModalActions confirmLabel="Done" onConfirm={() => setIsOpen(false)} />
      }
    >
      <div className="space-y-6">
        {setup.variables.length ? (
          <p className="rounded-xl border border-black/10 bg-black/[0.03] p-3 text-xs leading-relaxed text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
            {whereVariablesLive}
          </p>
        ) : null}

        <ol className="space-y-4">
          {setup.steps.map((step, index) => (
            <Step key={step.text} step={step} index={index} />
          ))}
        </ol>

        {setup.variables.length ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
              Variables to set
            </h3>
            <ul className="mt-2 grid gap-2">
              {setup.variables.map((variable) => (
                <Variable key={variable.name} variable={variable} />
              ))}
            </ul>
          </div>
        ) : null}

        {setup.doc ? (
          <div className="flex items-center gap-2 border-t border-black/[0.07] pt-4 dark:border-white/[0.07]">
            <span className="text-xs text-black/50 dark:text-white/50">
              Full reference
            </span>
            <code className="min-w-0 break-all font-mono text-[12px] text-black/70 dark:text-white/70">
              {setup.doc}
            </code>
            <span className="ml-auto">
              <CopyButton value={setup.doc} label="Doc path" />
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
