import type { Product } from "./types";

type DescriptionContent = { intro: string; details: string; html: boolean };

// Only split at a paragraph boundary when inline formatting is closed. An
// unfamiliar Shopify structure stays intact rather than losing rich content.
function hasClosedFormatting(html: string) {
  const tags: string[] = [];
  for (const match of html.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag = match[1].toLowerCase();
    if (["br", "hr", "img", "wbr", "input", "source"].includes(tag) || match[0].endsWith("/>")) continue;
    if (match[0].startsWith("</")) {
      if (tags.pop() !== tag) return false;
    } else {
      tags.push(tag);
    }
  }
  return tags.length === 0;
}

export function splitProductDescription({ description, descriptionHtml }: Pick<Product, "description" | "descriptionHtml">): DescriptionContent {
  const html = descriptionHtml.trim();
  if (html) {
    const paragraph = html.match(/^(<p\b[^>]*>)([\s\S]*?)<\/p>([\s\S]*)$/i);
    const lead = paragraph?.[2] ?? html;
    // Printful often puts its entire description in one paragraph, separated
    // by pairs of <br> tags rather than separate <p> elements.
    const breakMatch = /<br\s*\/?>\s*(?:&nbsp;\s*)?<br\s*\/?>/i.exec(lead);
    if (breakMatch && hasClosedFormatting(lead.slice(0, breakMatch.index))) {
      const intro = lead.slice(0, breakMatch.index);
      const rest = lead.slice(breakMatch.index + breakMatch[0].length);
      return {
        intro: paragraph ? `${paragraph[1]}${intro}</p>` : intro,
        details: paragraph ? `<p>${rest}</p>${paragraph[3]}` : rest,
        html: true,
      };
    }
    if (paragraph && paragraph[3].trim() && hasClosedFormatting(paragraph[2])) {
      return { intro: `${paragraph[1]}${paragraph[2]}</p>`, details: paragraph[3], html: true };
    }
    const needsDisclosure = html.replace(/<[^>]*>/g, "").length > 500 || /<(?:table|ul|ol|h[1-6])\b/i.test(html);
    return { intro: needsDisclosure ? "" : html, details: needsDisclosure ? html : "", html: true };
  }

  const boundary = /\r?\n\s*\r?\n|\r?\n(?=[•*−–-]\s)/.exec(description);
  if (boundary) {
    return { intro: description.slice(0, boundary.index), details: description.slice(boundary.index), html: false };
  }
  return { intro: description.length > 500 ? "" : description, details: description.length > 500 ? description : "", html: false };
}
