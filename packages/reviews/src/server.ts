// Server-only entry point. Never import this module from a client component.
import { createHash } from "node:crypto";

export type ReviewPhotoObject = { id: string; width: number; height: number; byteSize: number; sha256: string };
export function reviewPhotoObjectSchema(value: unknown): ReviewPhotoObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 5 && typeof row.id === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.id) &&
    [row.width, row.height].every((n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= 2048) &&
    typeof row.byteSize === "number" && Number.isSafeInteger(row.byteSize) && row.byteSize >= 1 && row.byteSize <= 4 * 1024 * 1024 &&
    typeof row.sha256 === "string" && /^[a-f0-9]{64}$/.test(row.sha256) ? row as ReviewPhotoObject : null;
}

/** Bounded binary reads shared by private photo upload and preview. Never return a partial body. */
export async function readReviewPhotoBytes(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Buffer | "too_large" | null> {
  const reader = stream?.getReader();
  if (!reader) return null;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 10_000);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) { await reader.cancel().catch(() => {}); return "too_large"; }
      chunks.push(Buffer.from(next.value));
    }
    return !timedOut && size > 0 ? Buffer.concat(chunks, size) : null;
  } catch { return null; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}

/** Check authority before and after a private, bounded, digest-verified download. */
export async function loadVerifiedReviewPhoto({ context, download }: {
  context: () => Promise<ReviewPhotoObject | null>;
  download: (photo: ReviewPhotoObject) => Promise<ReadableStream<Uint8Array> | null>;
}): Promise<Buffer | null> {
  const initial = await context();
  if (!initial) return null;
  const bytes = await readReviewPhotoBytes(await download(initial), initial.byteSize);
  if (!bytes || bytes === "too_large" || bytes.length !== initial.byteSize ||
    createHash("sha256").update(bytes).digest("hex") !== initial.sha256) throw new Error("Review photo unavailable.");
  const current = await context();
  if (!current) return null;
  if (current.id !== initial.id || current.sha256 !== initial.sha256 || current.byteSize !== initial.byteSize ||
    current.width !== initial.width || current.height !== initial.height) throw new Error("Review photo unavailable.");
  return bytes;
}
