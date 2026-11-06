// Judge.me's published review image hosts; keep Next image optimization scoped
// to these instead of allowing arbitrary user-supplied URLs.
export const reviewPhotoHosts = ["judgeme.imgix.net", "pub-images.judge.me"];

export function publishedReviewPhotoUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && reviewPhotoHosts.includes(url.hostname) && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}
