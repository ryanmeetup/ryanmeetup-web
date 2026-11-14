"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ToastBar,
  Toaster,
  resolveValue,
  toast as hotToast,
  type Toast,
  type ToastOptions,
} from "react-hot-toast";
import { FiX } from "react-icons/fi";

export type ToastHostProps = {
  duration?: number;
};

/**
 * Above everything a page can stack, including the ryanmeetup mobile menu
 * (`z-[10000]`): a toast reports what just happened, so nothing should cover
 * it.
 */
const TOAST_Z_INDEX = 2147483647;

function DismissToastButton({ toast: t }: { toast: Toast }) {
  return (
    <button
      type="button"
      aria-label="Dismiss notification"
      onClick={() => hotToast.dismiss(t.id)}
      className="-my-1 -mr-2 ml-1 inline-flex size-8 shrink-0 items-center justify-center self-start rounded-md text-current opacity-75 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10"
    >
      <FiX aria-hidden />
    </button>
  );
}

/**
 * Every toast carries a dismiss button, since a toast that can only time out
 * sits on top of a phone's limited screen until it does. This covers the
 * standard types; `toast.custom` skips the Toaster's renderer entirely, so it
 * is framed at creation instead (see `CustomToastFrame`).
 */
function renderToast(t: Toast) {
  return (
    <ToastBar toast={t}>
      {({ icon, message }) => (
        <>
          {icon}
          {message}
          {t.type !== "loading" && <DismissToastButton toast={t} />}
        </>
      )}
    </ToastBar>
  );
}

/**
 * A custom toast brings its own surface, so the dismiss button is pinned to
 * its corner, and the surface's right edge is reserved so a long message never
 * runs underneath it.
 */
function CustomToastFrame({
  children,
  toast: t,
}: {
  children: ReactNode;
  toast: Toast;
}) {
  return (
    <div
      className={`relative transition-opacity motion-reduce:transition-none [&>:first-child]:!pr-12 ${t.visible ? "opacity-100" : "opacity-0"}`}
    >
      {children}
      <span className="absolute right-3 top-3">
        <DismissToastButton toast={t} />
      </span>
    </div>
  );
}

function ToastHost({ duration = 4000 }: ToastHostProps) {
  // Portalled to the end of <body> so it is a sibling of the app tree, not a
  // descendant. That keeps it above any stacking context the page creates and
  // lets a Headless UI dialog treat it as its own root container, so tapping
  // a toast's dismiss button does not close the dialog behind it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <Toaster
      position="bottom-center"
      gutter={8}
      containerStyle={{ bottom: 24, zIndex: TOAST_Z_INDEX }}
      toastOptions={{
        duration,
        className:
          "!rounded-xl !border !border-black/10 !bg-white !px-4 !py-3 !font-semibold !text-black !shadow-xl dark:!border-white/15 dark:!bg-zinc-900 dark:!text-white",
        success: {
          className:
            "!rounded-xl !border !border-emerald-500/35 !bg-emerald-50 !px-4 !py-3 !font-semibold !text-emerald-800 !shadow-xl dark:!border-emerald-400/35 dark:!bg-emerald-950 dark:!text-emerald-100",
          iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
        },
        error: {
          duration: Math.max(duration, 5000),
          className:
            "!rounded-xl !border !border-red-500/35 !bg-red-50 !px-4 !py-3 !font-semibold !text-red-800 !shadow-xl dark:!border-red-400/35 dark:!bg-red-950 dark:!text-red-100",
          iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
        },
      }}
    >
      {renderToast}
    </Toaster>,
    document.body,
  );
}

function LinkedToastMessage({
  children,
  href,
  linkLabel,
}: {
  children: ReactNode;
  href: string;
  linkLabel: ReactNode;
}) {
  return (
    <span>
      {children}{" "}
      <a
        className="underline decoration-current/50 underline-offset-2 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        href={href}
      >
        {linkLabel}
      </a>
    </span>
  );
}

// A copy of react-hot-toast's API rather than additions to it: overriding
// `custom` on the library's own object would wrap it again on every module
// re-evaluation, and would change it for code that imports the library
// directly.
const customToast = hotToast.custom;

const toast = Object.assign(
  (...args: Parameters<typeof hotToast>) => hotToast(...args),
  hotToast,
  {
    custom(message: Parameters<typeof customToast>[0], options?: ToastOptions) {
      return customToast(
        (t) => (
          <CustomToastFrame toast={t}>
            {resolveValue(message, t)}
          </CustomToastFrame>
        ),
        options,
      );
    },
    successWithLink(
      message: ReactNode,
      {
        href,
        linkLabel,
        ...options
      }: ToastOptions & { href: string; linkLabel: ReactNode },
    ) {
      return hotToast.success(
        <LinkedToastMessage href={href} linkLabel={linkLabel}>
          {message}
        </LinkedToastMessage>,
        options,
      );
    },
  },
);

export { ToastHost, toast };
