export const reviewPhotoLimits = {
  count: 5,
  sourceBytes: 10 * 1024 * 1024,
  preparedBytes: 700 * 1024,
  longestSide: 1600,
  accept: "image/jpeg,image/png,image/webp",
} as const;

export type ReviewPhoto = {
  id: string;
  file: File;
  sourceKey: string;
  originalName: string;
  previewUrl: string;
};

export async function reviewPhotoKey(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `${file.name}:${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resize and re-encode local selections before transport. Five prepared photos
 * fit below 3.5 MB; rasterization also removes source EXIF/location metadata.
 * This is a client convenience, never a substitute for server validation.
 */
export async function prepareReviewPhoto(file: File, sourceKey?: string): Promise<ReviewPhoto> {
  if (!reviewPhotoLimits.accept.split(",").includes(file.type)) {
    throw new Error("Choose JPG, PNG, or WebP photos.");
  }
  if (!file.size || file.size > reviewPhotoLimits.sourceBytes) {
    throw new Error("Each photo must be between 1 byte and 10 MB.");
  }

  const key = sourceKey ?? await reviewPhotoKey(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`We couldn't open “${file.name}”. Try another JPG, PNG, or WebP photo.`);
  }

  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50_000_000) {
      throw new Error("That photo is too large to process. Choose one under 50 megapixels.");
    }
    const scale = Math.min(1, reviewPhotoLimits.longestSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("We couldn't prepare that photo. Please try again.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= reviewPhotoLimits.preparedBytes) {
        const prepared = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
        return {
          id: crypto.randomUUID(),
          file: prepared,
          sourceKey: key,
          originalName: file.name,
          previewUrl: URL.createObjectURL(prepared),
        };
      }
    }
    throw new Error("We couldn't make that photo small enough. Please choose a smaller image.");
  } finally {
    bitmap.close();
  }
}
