"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FiTool, FiX } from "react-icons/fi";
import { LuBug } from "react-icons/lu";
import { Banner, Button, IconButton } from "@ryanmeetup/ui";
import { getBugReportHref } from "@/lib/support";
import { usePromotion } from "./promotion";

// Launch-window notice. Remove the <BugReportBanner /> line in the root layout to retire
// it; the footer's "Report a bug" link stays as the permanent way in.
const DISMISSED_KEY = "store:bug-banner-dismissed";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Storage can be blocked (private windows, cleared site data); the banner just shows again.
function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Nothing to remember it in; it still hides for this visit below.
  }
  sessionDismissed = true;
  listeners.forEach((listener) => listener());
}

let sessionDismissed = false;

export function BugReportBanner() {
  const pathname = usePathname();
  // The server renders it for everyone: most visitors are new, so returning ones who
  // dismissed it get a brief flash instead of everyone getting a late pop-in.
  const dismissed = useSyncExternalStore(subscribe, () => sessionDismissed || isDismissed(), () => false);
  // A running sale takes the top of the page; two stacked banners bury the header.
  const promotion = usePromotion();

  // The contact page is where the banner leads, so it has nothing to add there.
  if (dismissed || promotion || pathname === "/contact") return null;

  return (
    <Banner
      variant="brand"
      className="!px-0"
      contentClassName="store-container"
      icon={<FiTool className="h-10 w-10" aria-hidden />}
      iconAlign="center"
      aria-label="Bug report notice"
      title="Ryan-tested, not yet Ryan-proofed."
      action={
        <div className="flex items-center gap-2">
          <Button.Link href={getBugReportHref(pathname)} variant="secondary" size="sm" leftIcon={<LuBug aria-hidden />} className="whitespace-nowrap">
            Report a bug
          </Button.Link>
          <IconButton label="Dismiss" tooltip={false} onClick={dismiss}>
            <FiX aria-hidden />
          </IconButton>
        </div>
      }
    >
      <p className="font-normal">See something broken or weird? Report it to help us keep improving the store. We’ll send you a discount code as a thanks.</p>
    </Banner>
  );
}
