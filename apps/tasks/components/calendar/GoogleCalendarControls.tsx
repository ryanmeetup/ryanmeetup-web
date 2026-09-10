"use client";

import { Button, Modal } from "@ryanmeetup/ui";
import { FiCalendar, FiCheck, FiLogIn, FiSettings, FiX } from "react-icons/fi";
import type { GoogleCalendarConnection } from "@/lib/calendar/google-calendar-types";

export function GoogleCalendarStatusButton({
  compact = false,
  configured,
  connection,
  loading,
  onClick,
}: {
  compact?: boolean;
  configured: boolean;
  connection: GoogleCalendarConnection;
  loading: boolean;
  onClick: () => void;
}) {
  const state = loading
    ? "Syncing"
    : connection.connected
      ? "Connected"
      : configured
        ? "Connect"
        : "Setup needed";

  // Three states worth telling apart at a glance: working, waiting on you, and
  // blocked upstream. `loading` only happens once connected, so a month change
  // reads as "Syncing" without the chip changing colour underneath it.
  const tone = connection.connected
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:border-emerald-500/55 dark:text-emerald-300"
    : configured
      ? "border-amber-500/35 bg-amber-500/10 text-amber-700 hover:border-amber-500/55 dark:text-amber-300"
      : "border-red-500/35 bg-red-500/10 text-red-700 hover:border-red-500/55 dark:text-red-300";
  const dot = connection.connected
    ? "bg-emerald-500"
    : configured
      ? "bg-amber-500"
      : "bg-red-500";

  // The compact form sits beside a page title and lets its accessible name
  // carry the full connection state. The regular form spells that state out in
  // an action row. Both open the same connection settings.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        connection.connected
          ? "Google Calendar is connected. Open connection settings."
          : configured
            ? "Google Calendar is ready to connect. Open connection settings."
            : "Google Calendar needs setup. Open connection settings."
      }
      className={`inline-flex shrink-0 items-center gap-2 border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30 ${compact ? "h-6 rounded-full px-2 font-sans text-[10px] normal-case tracking-normal" : "h-[34px] rounded-lg px-3 text-xs"} ${tone}`}
    >
      <span
        aria-hidden
        className={`block rounded-full ${compact ? "h-1.5 w-1.5" : "h-2 w-2"} ${dot}`}
      />
      {compact ? "Google" : `Google ${state}`}
    </button>
  );
}

export function GoogleCalendarSettingsModal({
  canManage,
  configured,
  connection,
  demoMode,
  disconnecting,
  loading,
  onDisconnect,
  open,
  setOpen,
}: {
  canManage: boolean;
  configured: boolean;
  connection: GoogleCalendarConnection;
  demoMode: boolean;
  disconnecting: boolean;
  loading: boolean;
  onDisconnect: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      setIsOpen={setOpen}
      title="Google Calendar"
      description={
        connection.connected
          ? "Keep the shared workspace calendar close to the rest of the schedule."
          : configured
            ? "Sign in with Google to bring the shared workspace calendar into Tasks."
            : "A workspace owner can finish the one-time setup from Admin."
      }
      size="md"
    >
      <div className="rounded-xl border border-black/10 bg-black/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-blue-500/10 p-2 text-blue-700 dark:text-blue-300">
            <FiCalendar aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {connection.connected && (
                <FiCheck
                  className="text-emerald-600 dark:text-emerald-300"
                  aria-hidden
                />
              )}
              {connection.connected
                ? "Connected"
                : configured
                  ? "Ready to connect"
                  : "Setup needed"}
            </p>
            {connection.email && (
              <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/60">
                {connection.email}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-black/65 dark:text-white/65">
          {connection.connected
            ? loading
              ? "Refreshing Google events for this month."
              : "Google events appear here automatically. Tasks dates are added to Google only when you choose that option."
            : configured
              ? "Continue with the Google account that owns the calendar. You can review access before anything is connected."
              : "Google Calendar is not ready for this workspace yet. Review the setup status in Admin, then return here to connect."}
        </p>
        {canManage ? (
          connection.connected ? (
            <Button
              className="mt-4 w-full"
              size="sm"
              variant="secondary"
              leftIcon={<FiX />}
              loading={disconnecting}
              onClick={onDisconnect}
            >
              Disconnect calendar
            </Button>
          ) : !configured ? (
            <Button.Link
              href="/admin"
              className="mt-4 w-full"
              size="sm"
              variant="secondary"
              leftIcon={<FiSettings />}
            >
              View setup status
            </Button.Link>
          ) : (
            <Button.Link
              href="/api/integrations/google-calendar/connect"
              className="mt-4 w-full"
              size="sm"
              leftIcon={<FiLogIn />}
              disabled={demoMode}
            >
              Continue with Google
            </Button.Link>
          )
        ) : (
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">
            A workspace owner manages this connection.
          </p>
        )}
      </div>
    </Modal>
  );
}
