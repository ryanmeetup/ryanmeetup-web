export const ACCESS_GROUP_COLORS = [
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Amber", value: "#d97706" },
  { label: "Green", value: "#16a34a" },
  { label: "Teal", value: "#0d9488" },
] as const;

export const ACCESS_GROUP_COLOR_OPTIONS = [
  { label: "Choose a color…", value: "" },
  ...ACCESS_GROUP_COLORS.map((color) => ({ ...color, color: color.value })),
];

export function accessGroupTextColor(color: string) {
  const hex = color.replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 160
    ? "#111827"
    : "#ffffff";
}

/**
 * `/admin/access/new` is the create route, which shadows a group page at the
 * same address, so no group may be named into that slug.
 */
export function isReservedAccessGroupName(name: string) {
  return accessGroupSlug(name) === "new";
}

export function accessGroupSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
