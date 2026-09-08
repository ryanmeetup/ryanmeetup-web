import { describe, expect, it } from "vitest";
import {
  extractPreviewImage,
  isPublicIpAddress,
} from "@/lib/server/link-preview";

describe("link preview metadata", () => {
  it("prefers the secure Open Graph image and resolves relative URLs", () => {
    const html = `
      <meta content="/fallback.jpg" property="og:image">
      <meta property="og:image:secure_url" content="/preview.jpg?size=small&amp;crop=1">
      <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
    `;
    expect(extractPreviewImage(html, "https://example.com/work/item")).toBe(
      "https://example.com/preview.jpg?size=small&crop=1",
    );
  });

  it("accepts Twitter card images when Open Graph metadata is absent", () => {
    expect(
      extractPreviewImage(
        '<meta content="https://cdn.example.com/card.jpg" name="twitter:image">',
        "https://example.com",
      ),
    ).toBe("https://cdn.example.com/card.jpg");
  });

  it("returns no image for missing or malformed metadata", () => {
    expect(
      extractPreviewImage("<title>Plain page</title>", "https://example.com"),
    ).toBeNull();
    expect(
      extractPreviewImage(
        '<meta property="og:image" content=":bad">',
        "not a url",
      ),
    ).toBeNull();
  });
});

describe("link preview network safety", () => {
  it("rejects private, loopback, link-local, and documentation addresses", () => {
    for (const address of [
      "0.0.0.0",
      "10.2.3.4",
      "127.0.0.1",
      "169.254.169.254",
      "172.20.1.1",
      "192.168.1.1",
      "192.0.2.1",
      "198.51.100.2",
      "203.0.113.2",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::7f00:1",
    ])
      expect(isPublicIpAddress(address), address).toBe(false);
  });

  it("accepts publicly routable IPv4 and IPv6 addresses", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });
});
