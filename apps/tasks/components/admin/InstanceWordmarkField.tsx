"use client";

import { useRef } from "react";
import { Button } from "@ryanmeetup/ui";

/**
 * The instance mark, leading the identity form the way the avatar leads the
 * profile form. Mirrors `components/profile/ProfileAvatarField.tsx`: a live
 * preview, the upload control, and one line of constraints.
 *
 * The preview is a wide plate rather than the profile's circle because a
 * wordmark is typeset text by default, and this is exactly how it renders in
 * the sidebar and sign-in card.
 */
export function InstanceWordmarkField({
  logoPath,
  name,
  uploading,
  disabled,
  onUpload,
  onClear,
}: {
  logoPath: string | null;
  name: string;
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        role="img"
        aria-label={logoPath ? "Instance logo preview" : "Instance wordmark"}
        className="flex h-20 min-w-40 max-w-64 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/5 px-5 dark:border-white/10 dark:bg-white/10"
      >
        {logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPath}
            alt=""
            className="max-h-12 w-auto max-w-full object-contain"
          />
        ) : (
          <span className="truncate font-cooper text-2xl uppercase">
            {name}
          </span>
        )}
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor="instance-logo"
            className={`inline-flex items-center justify-center rounded-lg border border-black/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-caps text-black transition focus-within:ring-2 focus-within:ring-black/30 dark:border-white/20 dark:bg-white/5 dark:text-white dark:focus-within:ring-white/30 ${
              disabled || uploading
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-black/40 hover:bg-black/5 dark:hover:border-white/40 dark:hover:bg-white/10"
            }`}
          >
            {uploading
              ? "Uploading..."
              : logoPath
                ? "Change image"
                : "Upload image"}
            <input
              ref={fileInput}
              id="instance-logo"
              name="instance-logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="sr-only"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                // A fresh value so re-picking the same file still fires change.
                if (fileInput.current) fileInput.current.value = "";
              }}
            />
          </label>
          {logoPath && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || uploading}
              onClick={onClear}
            >
              Use the name instead
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Optional · PNG, JPG, SVG, or WebP · 2 MB maximum
        </p>
      </div>
    </div>
  );
}
