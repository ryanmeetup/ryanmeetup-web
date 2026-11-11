import { normalizeHttpUrl } from "@ryanmeetup/utils";
import { TASK_LINK_TITLE_MAX_LENGTH } from "@/lib/tasks/task-attachment-urls";
import {
  objectWithKeys,
  optionalTrimmedText,
  parseUuid,
  requiredTrimmedText,
} from "./shared";

export function taskLinkAttachmentSchema(value: unknown) {
  const body = objectWithKeys(value, ["taskId", "url", "title"]);
  if (!body) return null;
  const taskId = parseUuid(body.taskId);
  const inputUrl = requiredTrimmedText(body.url, 2_048);
  const url = inputUrl ? normalizeHttpUrl(inputUrl) : null;
  const title = optionalTrimmedText(body.title, TASK_LINK_TITLE_MAX_LENGTH);
  return taskId && url && url.length <= 2_048 && title !== null
    ? { taskId, url, title }
    : null;
}
