import { isEditorSurface } from "@/lib/workspace/editor-surface";
import { isCalendarDefaultView } from "@/lib/calendar/calendar-view-preference";
import {
  objectWithKeys,
  optionalTrimmedText,
  parseUuid,
  requiredTrimmedText,
} from "./shared";

export function inviteSchema(value: unknown) {
  const body = objectWithKeys(value, ["email", "fullName"]);
  if (!body) return null;
  const email = requiredTrimmedText(body.email, 254);
  const fullName = optionalTrimmedText(body.fullName, 100);
  if (!email || fullName === null || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return null;
  return { email: email.toLowerCase(), fullName };
}

export function userDeleteSchema(value: unknown) {
  const body = objectWithKeys(value, ["userId"]);
  const userId = body && parseUuid(body.userId);
  return userId ? { userId } : null;
}

export function profileSchema(value: unknown) {
  const body = objectWithKeys(value, [
    "displayName",
    "avatarPath",
    "taskDetailsOpenByDefault",
    "assignNewTasksToSelf",
    "editorSurface",
    "calendarDefaultView",
  ]);
  if (
    !body ||
    typeof body.displayName !== "string" ||
    body.displayName.length > 200
  )
    return null;
  if (
    body.avatarPath !== undefined &&
    (typeof body.avatarPath !== "string" || body.avatarPath.length > 200)
  )
    return null;
  if (typeof body.taskDetailsOpenByDefault !== "boolean") return null;
  if (typeof body.assignNewTasksToSelf !== "boolean") return null;
  if (!isEditorSurface(body.editorSurface)) return null;
  if (!isCalendarDefaultView(body.calendarDefaultView)) return null;
  return {
    displayName: body.displayName,
    avatarPath: body.avatarPath as string | undefined,
    taskDetailsOpenByDefault: body.taskDetailsOpenByDefault,
    assignNewTasksToSelf: body.assignNewTasksToSelf,
    editorSurface: body.editorSurface,
    calendarDefaultView: body.calendarDefaultView,
  };
}
