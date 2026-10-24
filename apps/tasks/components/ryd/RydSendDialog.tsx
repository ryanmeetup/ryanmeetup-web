"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, ErrorCallout, Modal, Spinner } from "@ryanmeetup/ui";
import { FiDownload, FiMail, FiRefreshCw } from "react-icons/fi";
import { CopyButton } from "@/components/global";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { rydMailtoHref } from "@/lib/ryd/emails";
import type { RydFulfillmentPreview } from "@/lib/ryd/fulfillment";

export function RydSendDialog({
  orderIds,
  onClose,
}: {
  orderIds: string[];
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<RydFulfillmentPreview | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  function regenerate() {
    setPreview(null);
    setDownloadUrl("");
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    mutate<RydFulfillmentPreview>("/api/ryd/batches", {
      method: "POST",
      body: JSON.stringify({ orderIds }),
    })
      .then((result) => {
        if (active) {
          objectUrl = URL.createObjectURL(
            new Blob([result.csv], { type: "text/csv;charset=utf-8" }),
          );
          setDownloadUrl(objectUrl);
          setPreview(result);
        }
      })
      .catch((failure) => {
        if (active)
          setError(
            errorMessage(failure, "The email and CSV could not be generated."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, orderIds]);

  return (
    <Modal
      open
      setIsOpen={(open) => !open && onClose()}
      size="lg"
      title="Fulfillment email & CSV"
      description="Download the CSV, attach it to the email, and send it from your email app. Nothing is saved here. Move the orders to Sent to fulfillment yourself after sending."
      actions={
        <Button onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
      }
    >
      {loading && (
        <div className="flex items-center gap-3" role="status">
          <Spinner aria-hidden /> Generating email and CSV…
        </div>
      )}
      <ErrorCallout>{error}</ErrorCallout>
      {!preview && !loading && (
        <Button
          variant="secondary"
          className="mt-4 w-full sm:w-auto"
          onClick={regenerate}
        >
          Try again
        </Button>
      )}
      {preview && (
        <div className="space-y-6">
          <p className="text-sm text-black/70 dark:text-white/70">
            {preview.orderCount} selected{" "}
            {preview.orderCount === 1 ? "order" : "orders"}. Their stages stay
            unchanged until you move them manually.
          </p>
          <Button
            size="xs"
            variant="secondary"
            className="w-full sm:w-auto"
            leftIcon={<FiRefreshCw aria-hidden />}
            onClick={regenerate}
          >
            Regenerate email &amp; CSV
          </Button>
          <ol className="space-y-4">
            <RydDraftStep
              index={1}
              title="Download the CSV"
              description="Contains only the ready orders you selected."
            >
              <Button.Link
                href={downloadUrl || "#"}
                download={preview.filename}
                disabled={!downloadUrl}
                size="xs"
                variant="secondary"
                leftIcon={<FiDownload aria-hidden />}
                prefetch={false}
              >
                Download CSV
              </Button.Link>
            </RydDraftStep>
            <RydDraftStep
              index={2}
              title="Email fulfillment"
              description={
                <>
                  Opens an email to{" "}
                  <span className="font-semibold break-all">
                    {preview.recipient}
                  </span>
                  . Attach the CSV, then send.
                </>
              }
            >
              <Button.Link
                href={rydMailtoHref({
                  to: [preview.recipient],
                  ...preview.draft,
                })}
                size="xs"
                variant="secondary"
                leftIcon={<FiMail aria-hidden />}
                prefetch={false}
                newTab
              >
                Open email
              </Button.Link>
              <CopyButton
                value={`Subject: ${preview.draft.subject}\n\n${preview.draft.body}`}
                label="Email"
              >
                Copy email
              </CopyButton>
            </RydDraftStep>
          </ol>
        </div>
      )}
    </Modal>
  );
}

/** One numbered step of a manual send, with its actions beside it. */
function RydDraftStep({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {index}. {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      )}
    </li>
  );
}
