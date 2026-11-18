"use client";

import { useEffect } from "react";
import { StoreError } from "@/components/store-error";
import { SITE_NAME } from "@/lib/metadata";
import "./globals.css";

/**
 * Replaces the root layout when the layout itself fails, so it brings its own
 * document, styles, and theme. The store defaults to dark; a saved light
 * choice (next-themes keeps it under "theme") is applied after mount.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", window.localStorage.getItem("theme") !== "light");
    } catch {
      // Storage can be blocked; the dark default stands.
    }
  }, []);

  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <title>{`Something went wrong | ${SITE_NAME}`}</title>
        <StoreError error={error} retry={retry} />
      </body>
    </html>
  );
}
