import { NextResponse } from "next/server";
import { instanceSettingsSchema } from "@/lib/api-schema";
import { databaseFailure } from "@/lib/server/api-response";
import {
  apiError,
  auditPrivilegedAction,
  privilegedContext,
  readJson,
  recordWorkspaceActivity,
} from "@/lib/server/privileged-api";
import {
  INSTANCE_SETTINGS_COLUMNS,
  instanceSettingsColumn,
  overridesFromRow,
  type InstanceSettingsRow,
} from "@/lib/server/instance-settings";
import { resolveInstanceSettings, type InstanceSettings } from "@/lib/instance";

/**
 * Update the singleton branding row. Only presentational values are writable;
 * credentials and the task key prefix are deliberately not part of this
 * surface. See lib/server/integration-health.ts.
 */
export async function PATCH(request: Request) {
  const parsed = await readJson(request, instanceSettingsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await privilegedContext({ owner: true });
  if ("response" in context) return context.response;

  // The deploy preflight only checks the RY-D contract while RY-D is on, so
  // turning it on here is the other door. Refuse it on a database without
  // the RY-D tables, which the page has no fallback for.
  if (parsed.data.rydEnabled === true) {
    const { data: health, error } = await context.admin.rpc(
      "ryd_contract_health",
    );
    if (error || health?.contractOk !== true)
      return apiError(
        409,
        "CONFLICT",
        "RY-D can't be turned on until this instance's database has every RY-D migration applied.",
      );
  }

  const row: InstanceSettingsRow = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    row[instanceSettingsColumn(key as keyof InstanceSettings)] = value;
  }

  const { data, error } = await context.admin
    .from("instance_settings")
    // `id` is the singleton primary key, so this upsert always targets the one row.
    .upsert({ ...row, id: true, updated_by: context.user.id })
    .select(INSTANCE_SETTINGS_COLUMNS.join(", "))
    .single<InstanceSettingsRow>();
  if (error || !data) {
    return databaseFailure(
      request,
      "instance-settings.update",
      error ?? { message: "Instance settings upsert returned no row." },
      { error: "The settings could not be saved. Try again." },
    );
  }

  if (
    !(await auditPrivilegedAction(context.admin, context.user, {
      action: "instance-settings.update",
      targetType: "instance_settings",
      metadata: { fields: Object.keys(parsed.data) },
    }))
  )
    return apiError(
      500,
      "AUDIT_FAILED",
      "The settings were saved, but the audit record could not be written.",
    );

  // Branding and instance settings are workspace-wide: the feed is where a
  // teammate finds out why the product changed shape under them.
  await recordWorkspaceActivity(context.admin, context.user, {
    action: "settings.instance.update",
    targetType: "workspace",
    metadata: {
      resource_name: "Workspace settings",
      detail: Object.keys(parsed.data).join(", ") || undefined,
    },
  });

  // Both shapes: `settings` is what the app renders, `overrides` is the raw
  // row the settings form diffs against so it can distinguish a stored value
  // from an inherited default without a round trip.
  const saved = overridesFromRow(data);
  return NextResponse.json({
    settings: resolveInstanceSettings(saved),
    overrides: saved,
  });
}
