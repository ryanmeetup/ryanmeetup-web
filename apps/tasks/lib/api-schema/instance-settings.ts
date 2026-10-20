import { isBannerLinkHref } from "@/lib/instance";
import { colorSchema } from "./common";
import { objectWithKeys, requiredTrimmedText } from "./shared";

export function instanceSettingsSchema(value: unknown) {
  const fields = {
    name: (raw: unknown) => requiredTrimmedText(raw, 80),
    description: (raw: unknown) => requiredTrimmedText(raw, 400),
    monogram: (raw: unknown) =>
      typeof raw === "string" && [...raw.trim()].length === 1
        ? raw.trim()
        : null,
    accentColor: colorSchema,
    logoPath: (raw: unknown) =>
      typeof raw === "string" &&
      (/^\/[^/]/.test(raw) || /^https:\/\/[^\s]+$/.test(raw))
        ? raw
        : null,
    bannerEnabled: (raw: unknown) => (typeof raw === "boolean" ? raw : null),
    bannerMessage: (raw: unknown) => requiredTrimmedText(raw, 200),
    bannerLinkUrl: (raw: unknown) =>
      typeof raw === "string" &&
      isBannerLinkHref(raw.trim()) &&
      raw.length <= 2048
        ? raw.trim()
        : null,
    bannerLinkLabel: (raw: unknown) => requiredTrimmedText(raw, 60),
    ogAlt: (raw: unknown) => requiredTrimmedText(raw, 200),
    rydEnabled: (raw: unknown) => (typeof raw === "boolean" ? raw : null),
  } as const;

  const body = objectWithKeys(value, Object.keys(fields));
  if (!body) return null;

  const parsed: Record<string, unknown> = {};
  for (const [key, validate] of Object.entries(fields)) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (raw === null) {
      parsed[key] = null;
      continue;
    }
    const result = (validate as (input: unknown) => unknown)(raw);
    if (result === null || result === undefined || result === "") return null;
    parsed[key] = result;
  }
  return Object.keys(parsed).length ? parsed : null;
}
