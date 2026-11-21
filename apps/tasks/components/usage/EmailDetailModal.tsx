"use client";

import { FiMail } from "react-icons/fi";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmationDialog,
  EmptyState,
  ErrorCallout,
  Modal,
  toast,
} from "@ryanmeetup/ui";
import { FiLoader } from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import type {
  ResendEmailDetail,
  ResendEmailSummary,
} from "@/lib/usage/resend-usage-types";
import { EmailStatusBadge } from "./EmailStatusBadge";
import { errorMessage } from "@/lib/presentation";
import { formatTimestamp } from "@/lib/date-format";

const isolateEmailHtml = (html: string) => {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid:; font-src data:">`;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${policy}`)
    : `<!doctype html><html><head>${policy}</head><body>${html}</body></html>`;
};

export function EmailDetailModal({
  email,
  onClose,
}: {
  email: ResendEmailSummary;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ResendEmailDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"delay" | "cancel" | null>(
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/usage/emails/${email.id}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          email?: ResendEmailDetail;
          error?: string;
        };
        if (!response.ok || !payload.email) {
          throw new Error(
            payload.error || "The email content could not be loaded.",
          );
        }
        setDetail(payload.email);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          errorMessage(requestError, "The email content could not be loaded."),
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [email]);

  const updateSchedule = async (action: "delay" | "cancel") => {
    setPendingAction(action);
    let closeAfterUpdate = false;
    try {
      const result = await mutate<{ email: ResendEmailDetail }>(
        `/api/usage/emails/${email.id}`,
        { method: "POST", body: JSON.stringify({ action }) },
      );
      if (action === "cancel") {
        setConfirmCancel(false);
        toast.success("Scheduled email canceled.");
        closeAfterUpdate = true;
      } else {
        setDetail(result.email);
        toast.success("Email delayed by 30 minutes.");
      }
      router.refresh();
    } catch (actionError) {
      toast.error(
        errorMessage(
          actionError,
          `The email could not be ${action === "delay" ? "delayed" : "canceled"}.`,
        ),
      );
    } finally {
      setPendingAction(null);
    }
    if (closeAfterUpdate) onClose();
  };

  const scheduled =
    detail?.lastEvent === "scheduled" && Boolean(detail.scheduledAt);

  return (
    <>
      <Modal
        open
        setIsOpen={(open) => {
          if (!open && !pendingAction) onClose();
        }}
        title={email.subject}
        description="The exact content Resend stored for this email. Remote images are blocked so viewing it here does not trigger tracking pixels."
        size="xl"
        actions={
          scheduled ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={Boolean(pendingAction)}
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pendingAction === "delay"}
                loadingText="Delaying..."
                disabled={Boolean(pendingAction)}
                onClick={() => void updateSchedule("delay")}
              >
                Delay 30 minutes
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={Boolean(pendingAction)}
                onClick={() => setConfirmCancel(true)}
              >
                Cancel send
              </Button>
            </>
          ) : undefined
        }
      >
        {loading && (
          <div
            className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold"
            role="status"
          >
            <FiLoader className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading email content
          </div>
        )}
        {error && <ErrorCallout>{error}</ErrorCallout>}
        {detail && (
          <div className="space-y-5">
            <dl className="grid gap-3 rounded-xl border border-black/10 bg-black/[0.025] p-4 text-sm dark:border-white/10 dark:bg-white/[0.025] sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
                  From
                </dt>
                <dd className="mt-1 break-all">{detail.from}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
                  To
                </dt>
                <dd className="mt-1 break-all">
                  {detail.recipients.join(", ") || "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
                  {detail.lastEvent === "scheduled"
                    ? "Scheduled for"
                    : detail.lastEvent === "canceled" && detail.scheduledAt
                      ? "Canceled before"
                      : "Sent"}
                </dt>
                <dd className="mt-1">
                  <time dateTime={detail.scheduledAt ?? detail.createdAt}>
                    {formatTimestamp(detail.scheduledAt ?? detail.createdAt)}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
                  Status
                </dt>
                <dd className="mt-1">
                  <EmailStatusBadge status={detail.lastEvent} />
                </dd>
              </div>
            </dl>
            {detail.html ? (
              <iframe
                title={`Email content: ${detail.subject}`}
                sandbox=""
                srcDoc={isolateEmailHtml(detail.html)}
                className="h-[min(60vh,42rem)] w-full rounded-xl border border-black/10 bg-white dark:border-white/10"
              />
            ) : detail.text ? (
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-black/10 bg-white p-5 font-sans text-sm leading-relaxed text-black dark:border-white/10">
                {detail.text}
              </pre>
            ) : (
              <EmptyState icon={<FiMail />}
                variant="plain"
                message="Resend did not return a body for this email."
              />
            )}
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        open={confirmCancel}
        setOpen={(open) => {
          if (!pendingAction) setConfirmCancel(open);
        }}
        title="Cancel this scheduled email?"
        description={`Cancel “${email.subject}” before it is sent? A canceled Resend email cannot be rescheduled.`}
        confirmLabel="Cancel send"
        pendingLabel="Canceling send..."
        pending={pendingAction === "cancel"}
        destructive
        onConfirm={() => void updateSchedule("cancel")}
      />
    </>
  );
}
