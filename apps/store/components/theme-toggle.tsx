"use client";

import { useSyncExternalStore } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "next-themes";
import { Tooltip } from "@ryanmeetup/ui";

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme } = useTheme();

  // Keep the server and first client render identical. The persisted theme is
  // only available in the browser, so do not use it for markup until mounted.
  const isDark = !mounted || resolvedTheme !== "light";
  const label = isDark ? "Change to Light Mode" : "Change to Dark Mode";

  return (
    <Tooltip content={label} placement="bottom" disabled={!mounted}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/30 ${mounted ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {isDark ? <FiSun aria-hidden className="h-5 w-5" /> : <FiMoon aria-hidden className="h-5 w-5" />}
      </button>
    </Tooltip>
  );
}
