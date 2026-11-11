import type { ChangeEvent } from "react";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileAvatarField({
  preview,
  fallbackName,
  disabled,
  onChange,
}: {
  preview: string | null;
  fallbackName: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        role="img"
        aria-label={preview ? "Profile photo preview" : "Profile initials"}
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/5 bg-cover bg-center text-xl font-semibold text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/70"
        style={
          preview
            ? { backgroundImage: `url(${JSON.stringify(preview)})` }
            : undefined
        }
      >
        {!preview && initials(fallbackName)}
      </div>
      <div>
        <label
          htmlFor="profile-avatar"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-black/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-caps text-black transition hover:border-black/40 hover:bg-black/5 focus-within:ring-2 focus-within:ring-black/30 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/10 dark:focus-within:ring-white/30"
        >
          {preview ? "Change photo" : "Upload photo"}
          <input
            id="profile-avatar"
            name="profile-avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={onChange}
          />
        </label>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Optional · JPG, PNG, or WebP · 5 MB maximum
        </p>
      </div>
    </div>
  );
}
