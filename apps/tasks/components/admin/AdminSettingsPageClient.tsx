"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Heading } from "@ryanmeetup/ui";
import { FiArrowRight, FiEdit2, FiSettings } from "react-icons/fi";
import { PageHeader } from "@/components/global";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";
import {
  accentField,
  identityFields,
  logoKey,
  previewFields,
  bannerKeys,
  storedText,
  type InstanceTextKey,
} from "@/lib/admin/instance-settings-fields";
import {
  demoInstanceSettings,
  instanceDefaults,
  resolveInstanceSettings,
  type InstanceSettingsOverrides,
} from "@/lib/instance";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { AccentEmailPreview } from "./AccentEmailPreview";
import { AdminPageShell } from "./AdminPageShell";
import { BannerPreview } from "./BannerPreview";
import { BannerSettingsModal } from "./BannerSettingsModal";
import { EmailSettingsModal } from "./EmailSettingsModal";
import { FeatureSettingsModal } from "./FeatureSettingsModal";
import { IdentitySettingsModal } from "./IdentitySettingsModal";
import { InstanceLinkPreview } from "./InstanceLinkPreview";
import { LinkPreviewSettingsModal } from "./LinkPreviewSettingsModal";

type Dialog = "identity" | "banner" | "preview" | "email" | "features";

/** Which text keys each dialog owns, for the "N customized" counts. */
const dialogKeys: Record<Dialog, InstanceTextKey[]> = {
  identity: [...identityFields.map((field) => field.key), logoKey],
  preview: previewFields.map((field) => field.key),
  email: [accentField.key],
  // The banner mixes a switch, a link, and two text overrides, so it is
  // counted from the stored row rather than from a draft.
  banner: [],
  features: [],
};

/**
 * One concern on the overview: what it looks like right now, and a way in.
 *
 * The page deliberately holds no draft state and no save button. Each concern
 * is edited and written independently, so an identity change can never be
 * bundled into the same request as a change to the link preview.
 */
function SettingsCard({
  title,
  description,
  customized,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  description: string;
  customized: number;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Heading size="h2" className="flex items-center gap-3 text-xl">
            {title}
            {customized > 0 && (
              <span className="rounded-full bg-black/10 px-2.5 py-1 font-sans text-[11px] font-semibold leading-none tracking-normal text-black/60 dark:bg-white/10 dark:text-white/60">
                {customized} customized
              </span>
            )}
          </Heading>
          <p className="mt-2 max-w-prose text-sm text-black/65 dark:text-white/65">
            {description}
          </p>
        </div>
        {/* The board header's edit affordance: a labelled secondary button, so
            the action names what it opens rather than relying on an icon. */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          leftIcon={<FiEdit2 aria-hidden />}
          onClick={onEdit}
        >
          {editLabel}
        </Button>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AdminSettingsPageClient({
  initialData,
  demoMode,
  overrides,
  buildIdentity,
}: {
  initialData: WorkspaceData;
  demoMode: boolean;
  overrides: InstanceSettingsOverrides | null;
  buildIdentity: {
    label: string;
    value: string;
    variable: string;
    note: string;
  }[];
}) {
  const { data, setData } = useWorkspaceData(initialData, demoMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The last state the server confirmed. Each dialog seeds its draft from this
  // and hands back the row the API returned, so the overview stays in step
  // without re-fetching.
  const [stored, setStored] = useState(overrides);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const router = useRouter();

  const baseSettings = demoMode ? demoInstanceSettings : instanceDefaults;
  const settings = resolveInstanceSettings(stored, baseSettings);

  const countFor = (name: Dialog) =>
    dialogKeys[name].filter((key) => storedText(stored, key)).length +
    (name === "banner"
      ? bannerKeys.filter(
          (key) => stored?.[key] !== null && stored?.[key] !== undefined,
        ).length
      : 0) +
    (name === "features" && typeof stored?.rydEnabled === "boolean" ? 1 : 0);

  function saved(next: InstanceSettingsOverrides) {
    setStored(next);
    router.refresh();
  }

  const dialogProps = {
    overrides: stored,
    demoMode,
    baseSettings,
    onSaved: saved,
  };

  return (
    <AdminPageShell
      data={data}
      demoMode={demoMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      setData={setData}
    >
      <PageHeader
        icon={FiSettings}
        title="Settings"
        description="Branding for this instance. Each concern is edited and saved on its own — anything left blank inherits the value compiled into this deployment."
      />

      <div className="space-y-6">
        <SettingsCard
          title="Identity"
          description="The name and words this workspace goes by, in its own chrome and in the metadata other apps read."
          customized={countFor("identity")}
          onEdit={() => setDialog("identity")}
          editLabel="Edit identity"
        >
          <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              Wordmark
            </dt>
            <dd>
              {settings.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoPath}
                  alt={settings.name}
                  className="h-7 w-auto max-w-48 object-contain"
                />
              ) : (
                <span className="font-cooper text-xl uppercase">
                  {settings.name}
                </span>
              )}
            </dd>

            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              Description
            </dt>
            <dd className="text-sm text-black/70 dark:text-white/70">
              {settings.description}
            </dd>
          </dl>
        </SettingsCard>

        <SettingsCard
          title="Banner"
          description="The notice above the workspace: a beta warning, a maintenance window, or anything else this instance needs to say, with an optional link to act on it."
          customized={countFor("banner")}
          onEdit={() => setDialog("banner")}
          editLabel="Edit banner"
        >
          <BannerPreview settings={settings} />
        </SettingsCard>

        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsCard
            title="Link preview"
            description="The card other apps show when a link to this workspace is pasted into Slack, Messages, or Discord. It prints the name and description from Identity. The workspace is noindex, so this never reaches a search engine."
            customized={countFor("preview")}
            onEdit={() => setDialog("preview")}
            editLabel="Edit link preview"
          >
            <InstanceLinkPreview settings={settings} />
          </SettingsCard>

          <SettingsCard
            title="Email accent"
            description="The app is themed from the shared brand tokens, which email cannot use. This colour exists for that one reason and appears nowhere in the interface."
            customized={countFor("email")}
            onEdit={() => setDialog("email")}
            editLabel="Edit accent"
          >
            <AccentEmailPreview
              accentColor={settings.accentColor}
              wordmark={settings.name.toUpperCase()}
            />
          </SettingsCard>
        </div>

        <SettingsCard
          title="Features"
          description="Pages only some instances have. A page that is off is gone from the sidebar and from Access, not just closed."
          customized={countFor("features")}
          onEdit={() => setDialog("features")}
          editLabel="Edit features"
        >
          <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
              RY-D verification
            </dt>
            <dd className="text-sm text-black/70 dark:text-white/70">
              {settings.rydEnabled ? "On" : "Off"}
            </dd>
          </dl>
        </SettingsCard>

        <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
          <Heading size="h2" className="text-xl">
            Fixed at build time
          </Heading>
          <p className="mt-2 max-w-prose text-sm text-black/65 dark:text-white/65">
            These compose task URLs and changelog versions, so they cannot
            change without breaking existing links. Set them in the hosting
            environment and redeploy.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {buildIdentity.map((item) => (
              <li
                key={item.variable}
                className="rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.025]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <code className="rounded bg-black/[0.05] px-2 py-1 text-xs dark:bg-white/10">
                    {item.value}
                  </code>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-black/55 dark:text-white/55">
                  {item.note}
                </p>
                <code className="mt-2 inline-block rounded bg-black/[0.05] px-2 py-1 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
                  {item.variable}
                </code>
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/admin"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-black/10 p-5 transition hover:border-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:hover:border-white/25 dark:focus-visible:ring-white/40"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Integrations</span>
            <span className="mt-1 block text-xs leading-relaxed text-black/55 dark:text-white/55">
              Credentials live in the hosting environment and are reported on
              the admin overview.
            </span>
          </span>
          <FiArrowRight
            aria-hidden
            className="shrink-0 transition group-hover:translate-x-1 motion-reduce:transform-none"
          />
        </Link>
      </div>

      {/* Keyed on the stored row so a reopened dialog always starts from what
          the server last confirmed rather than a stale draft. */}
      {dialog === "identity" && (
        <IdentitySettingsModal
          key={JSON.stringify(stored)}
          open
          setOpen={(open) => !open && setDialog(null)}
          {...dialogProps}
        />
      )}
      {dialog === "banner" && (
        <BannerSettingsModal
          key={JSON.stringify(stored)}
          open
          setOpen={(open) => !open && setDialog(null)}
          {...dialogProps}
        />
      )}
      {dialog === "preview" && (
        <LinkPreviewSettingsModal
          key={JSON.stringify(stored)}
          open
          setOpen={(open) => !open && setDialog(null)}
          {...dialogProps}
        />
      )}
      {dialog === "features" && (
        <FeatureSettingsModal
          key={JSON.stringify(stored)}
          open
          setOpen={(open) => !open && setDialog(null)}
          {...dialogProps}
        />
      )}
      {dialog === "email" && (
        <EmailSettingsModal
          key={JSON.stringify(stored)}
          open
          setOpen={(open) => !open && setDialog(null)}
          {...dialogProps}
        />
      )}
    </AdminPageShell>
  );
}
