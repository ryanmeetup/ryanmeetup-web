import {
  defaultProjectStatus,
  isProjectStatus,
} from "@/lib/resources/project-status";
import { projectLinks } from "./resource-links";
import {
  calendarDate,
  objectWithKeys,
  optionalTrimmedText,
  parseUuid,
  requiredTrimmedText,
  uuidList,
} from "./shared";

/**
 * A project may only be dated forward. Either date on its own is fine, and a
 * patch that moves one of them is checked against what it sends: the column
 * constraint is what catches a half-sent pair.
 */
function orderedDates(start: string | null, due: string | null) {
  return !start || !due || start <= due;
}

export function projectCreateSchema(value: unknown) {
  const body = objectWithKeys(value, [
    "name",
    "description",
    "links",
    "ownerIds",
    "accessMode",
    "accessGroupIds",
    "status",
    "startDate",
    "dueDate",
  ]);
  if (!body) return null;
  const name = requiredTrimmedText(body.name, 100);
  const description = optionalTrimmedText(body.description, 1000);
  const links = projectLinks(body.links ?? []);
  const ownerIds = uuidList(body.ownerIds ?? []);
  const accessMode =
    body.accessMode === "owners" ||
    body.accessMode === "open" ||
    body.accessMode === "restricted"
      ? body.accessMode
      : null;
  const accessGroupIds = uuidList(body.accessGroupIds ?? []);
  const status = body.status ?? defaultProjectStatus;
  const startDate = calendarDate(body.startDate);
  const dueDate = calendarDate(body.dueDate);
  return name &&
    description &&
    links &&
    ownerIds?.length &&
    accessMode &&
    accessGroupIds &&
    isProjectStatus(status) &&
    startDate &&
    dueDate &&
    orderedDates(startDate.date, dueDate.date) &&
    (accessMode !== "restricted" || accessGroupIds.length > 0)
    ? {
        name,
        description,
        links,
        ownerIds,
        accessMode,
        accessGroupIds,
        status,
        startDate: startDate.date,
        dueDate: dueDate.date,
      }
    : null;
}

export function projectPatchSchema(value: unknown) {
  const body = objectWithKeys(value, [
    "id",
    "name",
    "description",
    "links",
    "archived",
    "ownerIds",
    "status",
    "startDate",
    "dueDate",
  ]);
  if (!body) return null;
  const id = parseUuid(body.id);
  const name =
    body.name === undefined ? undefined : requiredTrimmedText(body.name, 100);
  const description = optionalTrimmedText(body.description, 1000);
  const links = body.links === undefined ? undefined : projectLinks(body.links);
  const ownerIds =
    body.ownerIds === undefined ? undefined : uuidList(body.ownerIds);
  const status = body.status === undefined ? undefined : body.status;
  const startDate =
    body.startDate === undefined ? undefined : calendarDate(body.startDate);
  const dueDate =
    body.dueDate === undefined ? undefined : calendarDate(body.dueDate);
  if (
    !id ||
    name === null ||
    description === null ||
    links === null ||
    ownerIds === null ||
    (status !== undefined && !isProjectStatus(status)) ||
    (description !== undefined && !description) ||
    (ownerIds !== undefined && ownerIds.length === 0) ||
    startDate === null ||
    dueDate === null ||
    !orderedDates(startDate?.date ?? null, dueDate?.date ?? null) ||
    (body.archived !== undefined && typeof body.archived !== "boolean")
  )
    return null;
  return {
    id,
    name,
    description,
    links,
    archived: body.archived as boolean | undefined,
    ownerIds,
    status,
    startDate: startDate?.date,
    dueDate: dueDate?.date,
  };
}
