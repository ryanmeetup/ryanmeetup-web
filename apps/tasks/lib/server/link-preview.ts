import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

const MAX_HTML_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 4;

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv4");

for (const [network, prefix] of [
  ["::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv6");

function mappedIpv4Address(address: string) {
  const mapped = address.match(/^::ffff:(.+)$/i)?.[1];
  if (!mapped) return null;
  if (isIP(mapped) === 4) return mapped;
  const groups = mapped.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  )
    return null;
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;

  const mappedIpv4 = family === 6 ? mappedIpv4Address(address) : null;
  if (mappedIpv4) return isPublicIpAddress(mappedIpv4);

  return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}

function normalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

export async function requirePublicWebUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Unsupported preview URL");

  const hostname = normalizedHostname(url);
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  )
    throw new Error("Private preview URL");

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw new Error("Private preview URL");
    return url;
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Preview DNS lookup timed out")),
        2_000,
      );
    }),
  ]).finally(() => clearTimeout(timeout));
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  )
    throw new Error("Private preview URL");
  return url;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function extractPreviewImage(html: string, pageUrl: string) {
  const candidates = new Map<string, string>();
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const attributes = new Map<string, string>();
    const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    for (const match of tag.matchAll(pattern))
      attributes.set(
        match[1].toLowerCase(),
        decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? ""),
      );
    const key = (
      attributes.get("property") ?? attributes.get("name")
    )?.toLowerCase();
    const content = attributes.get("content")?.trim();
    if (key && content && !candidates.has(key)) candidates.set(key, content);
  }

  const value =
    candidates.get("og:image:secure_url") ??
    candidates.get("og:image") ??
    candidates.get("og:image:url") ??
    candidates.get("twitter:image");
  if (!value) return null;

  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
}

async function responseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_HTML_BYTES)
    throw new Error("Preview page is too large");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("Preview page is too large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function loadLinkPreviewImage(value: string) {
  let url = await requirePublicWebUrl(value);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "RyanMeetup-LinkPreview/1.0",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS)
        throw new Error("Preview redirected too many times");
      url = await requirePublicWebUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error("Preview page could not be loaded");
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    )
      return null;

    const image = extractPreviewImage(
      await responseText(response),
      url.toString(),
    );
    if (!image) return null;
    const imageUrl = await requirePublicWebUrl(image);
    return imageUrl.protocol === "https:" ? imageUrl.toString() : null;
  }

  return null;
}
