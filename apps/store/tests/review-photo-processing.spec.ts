import { expect, test } from "@playwright/test";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import {
  prepareReviewPhoto, REVIEW_PHOTO_INPUT_MAX_BYTES, REVIEW_PHOTO_INPUT_MAX_PIXELS,
  REVIEW_PHOTO_OUTPUT_MAX_BYTES, REVIEW_PHOTO_OUTPUT_MAX_EDGE,
} from "../lib/review-photo-processing";

const image = (width = 48, height = 32) => sharp({ create: { width, height, channels: 3, background: "red" } });
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
}
function pngChunks(bytes: Buffer) {
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    chunks.push({ type: bytes.toString("ascii", offset + 4, offset + 8), data: bytes.subarray(offset + 8, offset + 8 + size) });
    offset += size + 12;
  }
  return chunks;
}

test("JPEG, PNG and WebP are decoded and re-encoded as bounded, correctly labelled WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const input = await image().toFormat(format).toBuffer();
    const result = await prepareReviewPhoto(input, `image/${format}`);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a prepared fixture");
    const output = await sharp(result.photo.bytes).metadata();
    expect(result.photo).toMatchObject({ contentType: "image/webp", width: 48, height: 32 });
    expect(output).toMatchObject({ format: "webp", width: 48, height: 32 });
    expect(result.photo.bytes.length).toBeLessThanOrEqual(REVIEW_PHOTO_OUTPUT_MAX_BYTES);
  }
});

test("empty and oversized inputs stop before decoding, while the exact byte limit remains usable", async () => {
  expect(await prepareReviewPhoto(new Uint8Array())).toEqual({ ok: false, reason: "empty" });
  expect(await prepareReviewPhoto(Buffer.alloc(REVIEW_PHOTO_INPUT_MAX_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
  const source = await image().jpeg().toBuffer();
  const padded = Buffer.alloc(REVIEW_PHOTO_INPUT_MAX_BYTES, "private appended content");
  source.copy(padded);
  const result = await prepareReviewPhoto(padded);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected the byte-limit fixture to decode");
  expect(result.photo.bytes.includes(Buffer.from("private appended content"))).toBe(false);
});

test("file declarations cannot disguise unsupported or mismatched content; an absent MIME is sniffed", async () => {
  const jpeg = await image().jpeg().toBuffer();
  expect(await prepareReviewPhoto(jpeg, "image/png")).toEqual({ ok: false, reason: "type_mismatch" });
  expect(await prepareReviewPhoto(jpeg, "application/octet-stream")).toEqual({ ok: false, reason: "type_mismatch" });
  expect((await prepareReviewPhoto(jpeg, " IMAGE/JPEG; charset=binary ")).ok).toBe(true);
  expect((await prepareReviewPhoto(jpeg)).ok).toBe(true);
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://private.test/photo"/></svg>'),
    Buffer.from("<html>private original</html>"), await image().gif().toBuffer(), await image().tiff().toBuffer()]) {
    expect(await prepareReviewPhoto(bytes, "image/jpeg")).toEqual({ ok: false, reason: "unsupported_type" });
  }
});

test("truncated and falsely labelled binary images yield only a fixed failure reason", async () => {
  const input = await image().png().toBuffer();
  for (const bytes of [input.subarray(0, 25), Buffer.from([0xff, 0xd8, 0xff]), Buffer.concat([pngSignature, Buffer.from("private-original-data")])]) {
    expect(await prepareReviewPhoto(bytes)).toEqual({ ok: false, reason: "invalid_image" });
  }
});

test("landscape and portrait images shrink proportionally, and small images are not enlarged", async () => {
  for (const [width, height, expectedWidth, expectedHeight] of [[4096, 1024, 2048, 512], [1000, 4000, 512, 2048], [48, 32, 48, 32]]) {
    const result = await prepareReviewPhoto(await image(width, height).png().toBuffer());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a resizable fixture");
    expect(result.photo).toMatchObject({ width: expectedWidth, height: expectedHeight });
    expect(Math.max(result.photo.width, result.photo.height)).toBeLessThanOrEqual(REVIEW_PHOTO_OUTPUT_MAX_EDGE);
  }
});

test("a tiny compressed PNG advertising too many pixels is refused before pixel decoding", async () => {
  const source = pngChunks(await image(1, 1).png().toBuffer());
  const header = Buffer.from(source.find((part) => part.type === "IHDR")!.data);
  header.writeUInt32BE(10_000, 0); header.writeUInt32BE(4_001, 4);
  const bomb = Buffer.concat([pngSignature, ...source.map((part) => chunk(part.type, part.type === "IHDR" ? header : part.data))]);
  const metadata = await sharp(bomb, { limitInputPixels: false }).metadata();
  expect(metadata.width! * metadata.height!).toBeGreaterThan(REVIEW_PHOTO_INPUT_MAX_PIXELS);
  expect(bomb.length).toBeLessThan(1024);
  expect(await prepareReviewPhoto(bomb)).toEqual({ ok: false, reason: "invalid_image" });
});

test("EXIF orientation is baked into pixels and EXIF, GPS, XMP and ICC metadata are discarded", async () => {
  const pixels = Buffer.alloc(40 * 20 * 3);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) pixels[(y * 40 + x) * 3 + (x < 20 ? 0 : 2)] = 255;
  const source = await sharp(pixels, { raw: { width: 40, height: 20, channels: 3 } })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Artist: "Private photographer" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 48/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "122/1 24/1 0/1" } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>Private location</private></x:xmpmeta>')
    .jpeg().toBuffer();
  const before = await sharp(source).metadata();
  expect(before.orientation).toBe(6);
  expect(before.exif!.includes(Buffer.from("Private photographer"))).toBe(true);
  // The GPS IFD pointer proves this fixture actually contains GPS metadata.
  const tiff = before.exif!.subarray(6);
  const littleEndian = tiff.toString("ascii", 0, 2) === "II";
  const uint16 = (offset: number) => littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const uint32 = (offset: number) => littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  const directory = uint32(4);
  const entries = Array.from({ length: uint16(directory) }, (_, index) => directory + 2 + index * 12);
  const gpsPointer = entries.find((offset) => uint16(offset) === 0x8825);
  expect(gpsPointer).toBeDefined();
  const gps = uint32(gpsPointer! + 8);
  expect(Array.from({ length: uint16(gps) }, (_, index) => uint16(gps + 2 + index * 12))).toEqual(expect.arrayContaining([2, 4]));
  expect(before.icc).toBeDefined();
  expect(before.xmp).toBeDefined();
  const result = await prepareReviewPhoto(source, "image/jpeg");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected the oriented fixture to decode");
  const after = await sharp(result.photo.bytes).metadata();
  expect(result.photo).toMatchObject({ width: 20, height: 40 });
  for (const field of ["exif", "icc", "xmp", "iptc", "orientation"] as const) expect(after[field]).toBeUndefined();
  expect(result.photo.bytes.includes(Buffer.from("Private"))).toBe(false);
  const raw = await sharp(result.photo.bytes).raw().toBuffer({ resolveWithObject: true });
  const sample = (y: number, channel: number) => raw.data[(y * raw.info.width + 10) * raw.info.channels + channel];
  expect(sample(5, 0)).toBeGreaterThan(200); expect(sample(5, 2)).toBeLessThan(50);
  expect(sample(35, 2)).toBeGreaterThan(200); expect(sample(35, 0)).toBeLessThan(50);
});

test("PNG transparency survives normalization", async () => {
  const input = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
  const result = await prepareReviewPhoto(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected the transparent fixture to decode");
  expect((await sharp(result.photo.bytes).metadata()).hasAlpha).toBe(true);
  const raw = await sharp(result.photo.bytes).raw().toBuffer();
  expect(raw[3]).toBeGreaterThanOrEqual(127); expect(raw[3]).toBeLessThanOrEqual(129);
});

test("animated WebP and APNG are refused rather than silently keeping their first frame", async () => {
  const pixels = Buffer.concat([Buffer.alloc(8 * 8 * 3, Buffer.from([255, 0, 0])), Buffer.alloc(8 * 8 * 3, Buffer.from([0, 0, 255]))]);
  const animated = await sharp(pixels, { raw: { width: 8, height: 16, pageHeight: 8, channels: 3 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  expect((await sharp(animated).metadata()).pages).toBe(2);
  expect(await prepareReviewPhoto(animated)).toEqual({ ok: false, reason: "animated" });

  const frames = await Promise.all(["red", "blue"].map((background) => sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer()));
  const parsed = frames.map(pngChunks);
  const animationControl = Buffer.alloc(8); animationControl.writeUInt32BE(2, 0);
  const frameControl = (sequence: number) => {
    const data = Buffer.alloc(26); data.writeUInt32BE(sequence, 0); data.writeUInt32BE(8, 4); data.writeUInt32BE(8, 8);
    data.writeUInt16BE(1, 20); data.writeUInt16BE(10, 22);
    return chunk("fcTL", data);
  };
  const sequence = Buffer.alloc(4); sequence.writeUInt32BE(2);
  const apng = Buffer.concat([pngSignature, chunk("IHDR", parsed[0].find((part) => part.type === "IHDR")!.data), chunk("acTL", animationControl),
    frameControl(0), ...parsed[0].filter((part) => part.type === "IDAT").map((part) => chunk("IDAT", part.data)), frameControl(1),
    chunk("fdAT", Buffer.concat([sequence, ...parsed[1].filter((part) => part.type === "IDAT").map((part) => part.data)])), chunk("IEND", Buffer.alloc(0))]);
  expect((await sharp(apng).metadata()).format).toBe("png");
  expect(await prepareReviewPhoto(apng)).toEqual({ ok: false, reason: "animated" });
});

test("the processor owns its input bytes across asynchronous validation and returns no source metadata", async () => {
  const input = await image().jpeg().toBuffer();
  const pending = prepareReviewPhoto(input);
  input.fill(0);
  const result = await pending;
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected an owned copy of the fixture");
  expect(Object.keys(result.photo).sort()).toEqual(["bytes", "contentType", "height", "width"]);
  expect((await sharp(result.photo.bytes).metadata()).format).toBe("webp");
});
