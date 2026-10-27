"use client";

import { useState } from "react";
import { Button, ErrorCallout, Modal, Spinner } from "@ryanmeetup/ui";

/** Private evidence stays on the session-bound proxy, including in previews. */
export function RydEvidencePreview({
  fileId,
  index,
  onClose,
}: {
  fileId: string;
  index: number;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const label = `Uploaded image ${index + 1}`;

  return (
    <Modal
      open
      setIsOpen={(open) => !open && onClose()}
      title={label}
      size="xl"
      panelClassName="h-[44rem]"
      bodyClassName="h-full"
      dismissOnOutsideClick
      actions={
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onClose}
        >
          Close preview
        </Button>
      }
    >
      <div
        aria-busy={!loaded && !failed}
        className="relative flex h-full min-h-0 items-center justify-center"
      >
        {failed ? (
          <div className="space-y-4">
            <ErrorCallout>That image couldn&apos;t load. Try again.</ErrorCallout>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setLoaded(false);
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry image
            </Button>
          </div>
        ) : (
          <>
            {!loaded && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner label={`Loading uploaded image ${index + 1}`} />
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- Private, session-bound evidence must bypass the shared image optimizer. */}
            <img
              key={attempt}
              ref={(image) => {
                if (image?.complete && image.naturalWidth) setLoaded(true);
              }}
              src={`/api/ryd/evidence/${encodeURIComponent(fileId)}${attempt ? `?retry=${attempt}` : ""}`}
              alt={label}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`h-full w-full object-contain ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
