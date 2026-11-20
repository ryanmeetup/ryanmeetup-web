import sharp from "sharp";

/** Server processing limits, not authorization to upload or publish a photo. */
export const REVIEW_PHOTO_INPUT_MAX_BYTES = 10 * 1024 * 1024;
export const REVIEW_PHOTO_INPUT_MAX_PIXELS = 40_000_000;
export const REVIEW_PHOTO_OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
export const REVIEW_PHOTO_OUTPUT_MAX_EDGE = 2048;

export type ReviewPhotoFailure = "empty" | "too_large" | "unsupported_type" | "type_mismatch" | "animated" | "invalid_image" | "output_too_large";
export type PreparedReviewPhoto = { bytes: Buffer; contentType: "image/webp"; width: number; height: number };
export type ReviewPhotoProcessingResult = { ok: true; photo: PreparedReviewPhoto } | { ok: false; reason: ReviewPhotoFailure };

type RasterFormat = "jpeg" | "png" | "webp";
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function rasterFormat(bytes: Buffer): RasterFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.subarray(0, 8).equals(pngSignature)) return "png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from("RIFF")) && bytes.subarray(8, 12).equals(Buffer.from("WEBP"))) return "webp";
  return null;
}

/** PNG animation is not consistently exposed in decoder metadata; inspect its actual chunks too. */
function animatedContainer(bytes: Buffer, format: RasterFormat) {
  if (format === "jpeg") return false;
  let offset = format === "png" ? 8 : 12;
  while (offset + 8 <= bytes.length) {
    const length = format === "png" ? bytes.readUInt32BE(offset) : bytes.readUInt32LE(offset + 4);
    const type = bytes.toString("ascii", offset + (format === "png" ? 4 : 0), offset + (format === "png" ? 8 : 4));
    if (format === "png" ? type === "acTL" : type === "ANIM" || type === "ANMF") return true;
    const next = offset + 8 + length + (format === "png" ? 4 : length % 2);
    if (next > bytes.length) break; // The decoder will reject a corrupt/truncated image.
    if (format === "webp" && type === "VP8X" && length >= 1 && (bytes[offset + 8] & 2)) return true;
    offset = next;
  }
  return false;
}

/**
 * Server-only byte processing: no filenames, remote URLs, storage or buyer authority.
 * Re-encode decoded pixels; return no original bytes or caller-supplied metadata.
 */
export async function prepareReviewPhoto(input: Uint8Array, declaredContentType = ""): Promise<ReviewPhotoProcessingResult> {
  if (input.byteLength === 0) return { ok: false, reason: "empty" };
  if (input.byteLength > REVIEW_PHOTO_INPUT_MAX_BYTES) return { ok: false, reason: "too_large" };
  // Own the buffer so caller mutation cannot change a file after validation.
  const bytes = Buffer.from(input);
  const format = rasterFormat(bytes);
  if (!format) return { ok: false, reason: "unsupported_type" };
  const claimed = declaredContentType.split(";", 1)[0].trim().toLowerCase();
  if (claimed && claimed !== `image/${format}`) return { ok: false, reason: "type_mismatch" };
  if (animatedContainer(bytes, format)) return { ok: false, reason: "animated" };

  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: REVIEW_PHOTO_INPUT_MAX_PIXELS, limitInputChannels: 4, pages: 1 });
    const metadata = await image.metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height || metadata.width * metadata.height > REVIEW_PHOTO_INPUT_MAX_PIXELS) {
      return { ok: false, reason: "invalid_image" };
    }
    if ((metadata.pages ?? 1) > 1) return { ok: false, reason: "animated" };
    const { data, info } = await image
      .autoOrient()
      .resize({ width: REVIEW_PHOTO_OUTPUT_MAX_EDGE, height: REVIEW_PHOTO_OUTPUT_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      // Sharp drops EXIF, GPS, XMP and ICC metadata unless explicitly retained.
      .webp({ quality: 85, effort: 4 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    if (!data.length || data.length > REVIEW_PHOTO_OUTPUT_MAX_BYTES) return { ok: false, reason: "output_too_large" };
    if (info.format !== "webp" || info.width < 1 || info.height < 1 || info.width > REVIEW_PHOTO_OUTPUT_MAX_EDGE || info.height > REVIEW_PHOTO_OUTPUT_MAX_EDGE) {
      return { ok: false, reason: "invalid_image" };
    }
    return { ok: true, photo: { bytes: data, contentType: "image/webp", width: info.width, height: info.height } };
  } catch {
    // Decoder messages can contain embedded metadata. Return only a fixed reason.
    return { ok: false, reason: "invalid_image" };
  }
}
