"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import type { ButtonSize } from "./Button";
import { Tooltip } from "./Tooltip";

export type ModalActionsProps = {
  /** Label for the dismissing action. Omit `onCancel` to render confirm alone. */
  cancelLabel?: string;
  onCancel?: () => void;
  /** Defaults to `pending`; raise it when other work also blocks dismissal. */
  cancelDisabled?: boolean;
  confirmLabel: string;
  /** Binds confirm to a form by id; without it confirm is a plain button. */
  confirmForm?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmIcon?: ReactNode;
  /** Shown on hover/focus while the confirm is disabled, to explain why. */
  confirmTooltip?: ReactNode;
  destructive?: boolean;
  pending?: boolean;
  /** Defaults to `${confirmLabel}...` while pending. */
  pendingLabel?: string;
  size?: ButtonSize;
};

/**
 * The standard modal footer pair: dismiss on the left of the group, commit on
 * the right. Always pass this through `Modal`'s `actions` prop so the group
 * lands on the right edge of the footer; anything that belongs on the far left
 * (delete, secondary escapes) goes through `supportingActions` instead.
 */
const ModalActions = ({
  cancelLabel = "Cancel",
  onCancel,
  cancelDisabled,
  confirmLabel,
  confirmForm,
  onConfirm,
  confirmDisabled = false,
  confirmIcon,
  confirmTooltip,
  destructive = false,
  pending = false,
  pendingLabel,
  size = "sm",
}: ModalActionsProps) => {
  const confirm = (
    <Button
      type={confirmForm ? "submit" : "button"}
      form={confirmForm}
      variant={destructive ? "danger" : "primary"}
      size={size}
      className="w-full sm:w-auto"
      leftIcon={confirmIcon}
      loading={pending}
      loadingText={pendingLabel ?? `${confirmLabel}...`}
      disabled={confirmDisabled}
      onClick={onConfirm}
    >
      {confirmLabel}
    </Button>
  );

  return (
    <>
      {onCancel && (
        <Button
          type="button"
          variant="secondary"
          size={size}
          disabled={cancelDisabled ?? pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      )}
      {confirmTooltip ? (
        // The tooltip's trigger sits between the footer's action group and the
        // button, so the group's stacking rule cannot reach the button on its
        // own. Both wrappers carry the same width as the button they hold.
        <Tooltip
          content={confirmTooltip}
          disabled={!confirmDisabled}
          triggerClassName="w-full sm:w-auto"
        >
          <span
            className="block w-full sm:w-auto"
            tabIndex={confirmDisabled ? 0 : -1}
          >
            {confirm}
          </span>
        </Tooltip>
      ) : (
        confirm
      )}
    </>
  );
};

export { ModalActions };
