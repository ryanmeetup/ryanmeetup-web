export const TASK_LINK_TITLE_MAX_LENGTH = 500;

export function attachmentUrlName(value: string, title?: string) {
  const url = new URL(value);
  const rawPathName = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let pathName = rawPathName;
  try {
    pathName = decodeURIComponent(rawPathName);
  } catch {
    // Keep the encoded path when a URL contains an incomplete escape sequence.
  }
  return title?.trim() || pathName || url.hostname;
}
