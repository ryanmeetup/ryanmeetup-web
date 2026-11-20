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
