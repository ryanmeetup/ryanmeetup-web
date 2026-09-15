import { colorSchema } from "./common";
import { projectLinks } from "./resource-links";
import {
  objectWithKeys,
  optionalTrimmedText,
  parseUuid,
  requiredTrimmedText,
  uuidList,
} from "./shared";

export function categorySchema(value: unknown, requireId = false) {
  const body = objectWithKeys(value, [
    "id",
    "name",
    "description",
    "color",
    "links",
    "tags",
    "ownerIds",
    "archived",
    "accessMode",
    "accessGroupIds",
  ]);
  if (!body) return null;
  const id = requireId ? parseUuid(body.id) : undefined;
  const name = requiredTrimmedText(body.name, 80);
  const description = optionalTrimmedText(body.description, 500);
  const validColor = colorSchema(body.color);
  const links = projectLinks(body.links ?? []);
  const rawTags = body.tags ?? [];
  const tags = Array.isArray(rawTags)
    ? [
        ...new Set(
          rawTags.map((tag) => requiredTrimmedText(tag, 40)).filter(Boolean),
        ),
      ]
    : null;
  const archived = body.archived;
  const ownerIds =
    body.ownerIds === undefined ? undefined : uuidList(body.ownerIds);
  const accessMode =
    body.accessMode === undefined
      ? undefined
      : body.accessMode === "open" || body.accessMode === "restricted"
        ? body.accessMode
        : null;
  const accessGroupIds =
    body.accessGroupIds === undefined
      ? undefined
      : uuidList(body.accessGroupIds);
  if (
    (requireId && !id) ||
    !name ||
    description === null ||
    (!requireId && !description) ||
    !validColor ||
    !links ||
    !tags ||
    ownerIds === null ||
    accessMode === null ||
    accessGroupIds === null ||
    (!requireId && (!ownerIds || ownerIds.length === 0)) ||
    (ownerIds !== undefined && ownerIds.length === 0) ||
    (archived !== undefined && typeof archived !== "boolean")
  )
    return null;
  return {
    id,
    name,
    description: description || null,
    color: validColor,
    links,
    tags,
    ownerIds,
    archived: archived as boolean | undefined,
    accessMode: accessMode as "open" | "restricted" | undefined,
    accessGroupIds,
  };
}
