import { isRydContactEmail } from "@/lib/ryd/normalize";

// Opens a blank draft to one person in the default mail app; anything that
// isn't a usable address stays plain text.
export function RydEmailLink({
  email,
  fallback = "No email given",
  className = "",
}: {
  email: string;
  fallback?: string;
  className?: string;
}) {
  if (!isRydContactEmail(email))
    return <span className={className}>{email || fallback}</span>;
  return (
    <a
      href={`mailto:${encodeURIComponent(email.trim())}`}
      title={`Email ${email.trim()}`}
      className={`underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70 ${className}`}
    >
      {email.trim()}
    </a>
  );
}
