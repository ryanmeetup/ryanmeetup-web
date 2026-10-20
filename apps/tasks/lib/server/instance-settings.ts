import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  APPLY_MIGRATIONS_HINT,
  isMissingColumn,
  isMissingRelation,
} from "@/lib/server/supabase-errors";
import { isWorkspaceDemo } from "@/lib/server/workspace-page-loader";
import {
  demoInstanceSettings,
  instanceDefaults,
  instancePageTitle,
  resolveInstanceSettings,
  type InstanceSettings,
  type InstanceSettingsOverrides,
} from "@/lib/instance";

/** Columns of `instance_settings`, in the order the settings form presents them. */
export const INSTANCE_SETTINGS_COLUMNS = [
  "name",
  "description",
  "monogram",
  "accent_color",
  "logo_path",
  "banner_enabled",
  "banner_message",
  "banner_link_url",
  "banner_link_label",
  "footer_subtitle",
  "footer_sections",
  "footer_socials",
  "credit_prefix",
  "credit_label",
  "credit_url",
  "credit_suffix",
  "og_alt",
  "ryd_enabled",
] as const;

type SettingsColumn = (typeof INSTANCE_SETTINGS_COLUMNS)[number];
/** `footer_sections` and `footer_socials` are jsonb; every other column is text. */
export type InstanceSettingsRow = Partial<
  Record<SettingsColumn, unknown | null>
>;
type SettingsRow = InstanceSettingsRow;

const columnToKey = {
  name: "name",
  description: "description",
  monogram: "monogram",
  accent_color: "accentColor",
  logo_path: "logoPath",
  banner_enabled: "bannerEnabled",
  banner_message: "bannerMessage",
  banner_link_url: "bannerLinkUrl",
  banner_link_label: "bannerLinkLabel",
  footer_subtitle: "footerSubtitle",
  footer_sections: "footerSections",
  footer_socials: "footerSocials",
  credit_prefix: "creditPrefix",
  credit_label: "creditLabel",
  credit_url: "creditUrl",
  credit_suffix: "creditSuffix",
  og_alt: "ogAlt",
  ryd_enabled: "rydEnabled",
} as const satisfies Record<SettingsColumn, keyof InstanceSettings>;

export const instanceSettingsColumn = (key: keyof InstanceSettings) =>
  (Object.keys(columnToKey) as SettingsColumn[]).find(
    (column) => columnToKey[column] === key,
  )!;

export function overridesFromRow(row: SettingsRow): InstanceSettingsOverrides {
  const overrides: InstanceSettingsOverrides = {};
  for (const column of INSTANCE_SETTINGS_COLUMNS) {
    if (!(column in row)) continue;
    (overrides as Record<string, unknown>)[columnToKey[column]] = row[column];
  }
  return overrides;
}

/**
 * The stored branding overrides, or `null` when the table has not been created
 * yet. Missing-relation is tolerated on purpose so the app keeps serving its
 * build-time defaults in the window between deploying this code and applying
 * the migration that creates the table. Every other failure propagates rather
 * than being silently swallowed.
 */
async function readOverrides(): Promise<InstanceSettingsOverrides | null> {
  if (await isWorkspaceDemo()) return null;
  const supabase = await createClient();
  const select = (columns: readonly string[]) =>
    supabase
      .from("instance_settings")
      .select(columns.join(", "))
      .maybeSingle<SettingsRow>();
  let { data, error } = await select(INSTANCE_SETTINGS_COLUMNS);
  // `ryd_enabled` arrived after both instances were running. Until a database
  // has it, read everything else and leave RY-D at its default (off), so the
  // deploy and the migration can land in either order.
  if (error && isMissingColumn(error.code)) {
    console.warn(
      `instance_settings.ryd_enabled is missing; RY-D stays off. ${APPLY_MIGRATIONS_HINT}`,
    );
    ({ data, error } = await select(
      INSTANCE_SETTINGS_COLUMNS.filter((column) => column !== "ryd_enabled"),
    ));
  }

  if (error) {
    if (isMissingRelation(error.code)) {
      console.warn(
        `instance_settings is missing; serving build-time branding defaults. ${APPLY_MIGRATIONS_HINT}`,
      );
      return null;
    }
    throw new Error(`Instance settings could not be loaded: ${error.message}`);
  }
  return data ? overridesFromRow(data) : null;
}

/**
 * Resolved branding for this request. Deduplicated per request so the layout,
 * page metadata, and OG image share a single query.
 */
export const getInstanceSettings = cache(
  async (): Promise<InstanceSettings> => {
    if (await isWorkspaceDemo()) return demoInstanceSettings;
    return resolveInstanceSettings(await readOverrides());
  },
);

/** Raw overrides for the settings form, so it can show what is stored vs default. */
export const getInstanceSettingsOverrides = cache(readOverrides);

/** Absolute page title. Every route sets one; see AGENTS.md "Page metadata titles". */
export async function pageTitle(title: string) {
  return instancePageTitle(await getInstanceSettings(), title);
}

export { instanceDefaults };
