// Shopify keeps a heart emoji from a title in the handle it generates ("I ❤️ RY" becomes
// `i-❤️-ry`), which breaks routing and shared links. Every handle and listing URL the
// storefront builds spells it "heart" instead; titles keep the emoji.
const heartPattern = /[❤♥♡]️?/gu;

export function replaceHeartEmoji(text: string, replacement = "heart") {
  return text.replace(heartPattern, replacement);
}

export function normalizeHandle(handle: string) {
  return replaceHeartEmoji(handle);
}

// Route params arrive percent-encoded when the URL holds non-ASCII characters.
export function decodeRouteHandle(handle: string) {
  try {
    return decodeURIComponent(handle);
  } catch {
    return handle;
  }
}
