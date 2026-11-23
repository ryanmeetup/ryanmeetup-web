import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmailDetailPageClient } from "@/components/usage";
import { getResendEmail } from "@/lib/server/resend-usage";
import { pageTitle } from "@/lib/server/instance-settings";
import { loadWorkspacePage } from "@/lib/server/workspace-page-loader";

const EMAIL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Email") } };
}

/**
 * The mobile route for one email in the usage page's activity; the usage page
 * keeps the dialog from `sm` up. Resend's ID is the only identifier an email
 * has, so the route names it.
 */
export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!EMAIL_ID_PATTERN.test(id)) notFound();
  const { data } = await loadWorkspacePage(
    ["profiles", "statuses", "categories", "projects"],
    { owner: true },
  );
  // A Resend outage leaves the page up with a message; a missing email is a 404.
  const loaded = await getResendEmail(id).then(
    (detail) => ({ detail }),
    () => ({ error: "The email content could not be loaded. Try again." }),
  );
  if ("detail" in loaded && !loaded.detail) notFound();
  const detail = "detail" in loaded ? (loaded.detail ?? undefined) : undefined;
  const error = "error" in loaded ? loaded.error : undefined;
  return (
    <EmailDetailPageClient
      initialData={data}
      id={id}
      detail={detail}
      error={error}
    />
  );
}
