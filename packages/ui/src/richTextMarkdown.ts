import type { JSONContent } from "@tiptap/core";

const normalizeRichTextValue = (value: unknown) =>
  (Array.isArray(value) ? value.join("\n") : String(value ?? ""))
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type InlineMarkdownOptions = {
  linkify?: boolean;
};

const trailingLinkPunctuation = /[.,;:!?]$/;

const linkClassName =
  "relative z-10 font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:text-blue-300 dark:hover:text-blue-200";

/** Matches the placeholders `tokenizeLinks` leaves where each URL was. */
const linkTokenPattern = /\uE000(\d+)\uE001/;

/**
 * Swaps each plain HTTP URL for a placeholder so emphasis parsing cannot reach
 * inside it (underscores in a path are not italics). `links[n]` is the URL
 * behind placeholder `n`.
 */
function tokenizeLinks(value: string) {
  const links: string[] = [];
  const tokenized = value.replace(/https?:\/\/[^\s<>"']+/gi, (match) => {
    let candidate = match;
    while (
      trailingLinkPunctuation.test(candidate) ||
      (candidate.endsWith(")") &&
        candidate.split(")").length > candidate.split("(").length)
    )
      candidate = candidate.slice(0, -1);

    try {
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") return match;
    } catch {
      return match;
    }

    const trailing = match.slice(candidate.length);
    const token = `\uE000${links.length}\uE001`;
    links.push(candidate);
    return `${token}${trailing}`;
  });

  return { links, tokenized };
}

const inlineMarkdownToHtml = (
  value: string,
  { linkify = false }: InlineMarkdownOptions = {},
) => {
  const { links, tokenized } = linkify
    ? tokenizeLinks(value)
    : { links: [], tokenized: value };
  const html = escapeHtml(tokenized)
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<em><strong>$1</strong></em>")
    .replace(/___([^_\n]+)___/g, "<em><strong>$1</strong></em>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return links.reduce(
    (rendered, link, index) =>
      rendered.replace(
        `\uE000${index}\uE001`,
        `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="${linkClassName}">${escapeHtml(link)}</a>`,
      ),
    html,
  );
};

type ListKind = "bullet" | "ordered" | "task";
type ParsedListLine = {
  depth: number;
  kind: ListKind;
  checked: boolean;
  text: string;
};

type ParsedHeadingLine = {
  level: number;
  text: string;
};

const parseHeadingLine = (line: string): ParsedHeadingLine | null => {
  const match = line.match(/^(#{1,6})[\t ]+(.+?)(?:[\t ]+#+[\t ]*)?$/);
  return match ? { level: match[1].length, text: match[2] } : null;
};

const parseListLine = (line: string): ParsedListLine | null => {
  const match = line.match(
    /^(\s*)([-*+]|\d+\.)(?:\s+(?:\[([ xX])\]\s*)?(.*))?$/,
  );
  if (!match) return null;
  const whitespace = match[1].replace(/\t/g, "  ").length;
  const depth = Math.floor(whitespace / 2);
  const task = match[3] !== undefined;
  return {
    depth,
    kind: task
      ? "task"
      : /^\d/.test(match[2]) && depth === 0
        ? "ordered"
        : "bullet",
    checked: task && match[3].toLowerCase() === "x",
    text: match[4] ?? "",
  };
};

const listTags = (kind: ListKind) =>
  kind === "ordered"
    ? ["<ol>", "</ol>"]
    : kind === "task"
      ? ['<ul data-type="taskList">', "</ul>"]
      : ["<ul>", "</ul>"];

function renderList(
  items: ParsedListLine[],
  start: number,
  depth: number,
  kind: ListKind,
): [string, number] {
  const [open, close] = listTags(kind);
  let html = open;
  let index = start;
  while (index < items.length) {
    const item = items[index];
    if (item.depth < depth || (item.depth === depth && item.kind !== kind))
      break;
    if (item.depth > depth) break;
    const itemOpen =
      kind === "task"
        ? `<li data-type="taskItem" data-checked="${item.checked}"><p>`
        : "<li><p>";
    html += `${itemOpen}${item.text ? inlineMarkdownToHtml(item.text) : "<br>"}</p>`;
    index += 1;
    while (index < items.length && items[index].depth > depth) {
      const child = items[index];
      const childKind = child.kind === "ordered" ? "bullet" : child.kind;
      const rendered = renderList(items, index, child.depth, childKind);
      html += rendered[0];
      index = rendered[1];
    }
    html += "</li>";
  }
  return [`${html}${close}`, index];
}

const markdownToHtml = (markdown: unknown) => {
  const normalizedMarkdown = normalizeRichTextValue(markdown);
  if (!normalizedMarkdown) return "<p></p>";

  const lines = normalizedMarkdown.split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      blocks.push("<p><br></p>");
      index += 1;
      continue;
    }
    const heading = parseHeadingLine(lines[index]);
    if (heading) {
      blocks.push(
        `<h${heading.level}>${inlineMarkdownToHtml(heading.text)}</h${heading.level}>`,
      );
      index += 1;
      continue;
    }
    if (/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(lines[index])) {
      blocks.push("<hr>");
      index += 1;
      continue;
    }
    const firstList = parseListLine(lines[index]);
    if (firstList) {
      const listLines: ParsedListLine[] = [];
      while (index < lines.length) {
        const parsed = parseListLine(lines[index]);
        if (parsed) {
          listLines.push(parsed);
          index += 1;
          continue;
        }
        break;
      }
      let listIndex = 0;
      while (listIndex < listLines.length) {
        const root = listLines[listIndex];
        const rendered = renderList(
          listLines,
          listIndex,
          root.depth,
          root.kind,
        );
        blocks.push(rendered[0]);
        listIndex = rendered[1];
      }
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseHeadingLine(lines[index]) &&
      !parseListLine(lines[index]) &&
      !/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(lines[index])
    ) {
      paragraph.push(inlineMarkdownToHtml(lines[index]));
      index += 1;
    }
    blocks.push(`<p>${paragraph.join("<br>")}</p>`);
  }
  return blocks.join("") || "<p></p>";
};

const serializeInline = (node: JSONContent): string => {
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") {
    let text = node.text ?? "";
    const marks = node.marks ?? [];
    if (marks.some((mark) => mark.type === "bold")) text = `**${text}**`;
    if (marks.some((mark) => mark.type === "italic")) text = `*${text}*`;
    return text;
  }
  return (node.content ?? []).map(serializeInline).join("");
};

const serializeList = (node: JSONContent, depth: number): string[] => {
  const lines: string[] = [];
  const taskList = node.type === "taskList";
  const ordered = node.type === "orderedList" && depth === 0;
  (node.content ?? []).forEach((item, itemIndex) => {
    const paragraph = item.content?.find((child) => child.type === "paragraph");
    const marker = taskList
      ? `- [${item.attrs?.checked ? "x" : " "}]`
      : ordered
        ? `${itemIndex + 1}.`
        : "-";
    lines.push(
      `${"\t".repeat(depth)}${marker} ${paragraph ? serializeInline(paragraph) : ""}`,
    );
    (item.content ?? [])
      .filter((child) =>
        ["bulletList", "orderedList", "taskList"].includes(child.type ?? ""),
      )
      .forEach((child) => lines.push(...serializeList(child, depth + 1)));
  });
  return lines;
};

const tiptapJsonToMarkdown = (json: JSONContent) =>
  (json.content ?? [])
    .flatMap((node) => {
      if (["bulletList", "orderedList", "taskList"].includes(node.type ?? ""))
        return serializeList(node, 0);
      if (node.type === "horizontalRule") return ["---"];
      if (node.type === "heading") {
        const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
        return [`${"#".repeat(level)} ${serializeInline(node)}`];
      }
      return [serializeInline(node)];
    })
    .join("\n")
    .trimEnd();

const isThematicBreak = (line: string) =>
  /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(line);

// Drops a trailing unmatched emphasis marker so a cut line never renders a
// stray `**` or `*`.
function balanceInlineMarkers(line: string) {
  let balanced = line;

  for (const marker of ["**", "__"]) {
    if (balanced.split(marker).length % 2 === 0) {
      const index = balanced.lastIndexOf(marker);
      balanced =
        balanced.slice(0, index) + balanced.slice(index + marker.length);
    }
  }

  if ((balanced.replace(/\*\*/g, "").match(/\*/g)?.length ?? 0) % 2 === 1) {
    const index = balanced.lastIndexOf("*");
    balanced = balanced.slice(0, index) + balanced.slice(index + 1);
  }

  return balanced;
}

function truncateLine(line: string, maxLength: number) {
  const cut = line.slice(0, maxLength);
  const wordBoundary = cut.lastIndexOf(" ");
  const trimmed = (
    wordBoundary > maxLength / 2 ? cut.slice(0, wordBoundary) : cut
  ).trimEnd();

  return `${balanceInlineMarkers(trimmed).replace(/[\s,;:.-]+$/, "")}…`;
}

type MarkdownPreviewOptions = {
  /** Characters of visible text the preview may spend across its lines. */
  maxLength?: number;
  maxLines?: number;
};

/**
 * Shortens stored Markdown for a card without breaking its structure: whole
 * lines are kept so list markers and dividers still parse, blank lines
 * collapse, and only the final line is cut. Flattening the text and slicing it
 * by characters instead turns a list into one run-on string.
 */
const getMarkdownPreview = (
  value: string,
  { maxLength = 160, maxLines = 3 }: MarkdownPreviewOptions = {},
) => {
  // Blank lines collapse to a single paragraph gap, which costs nothing
  // against the line budget.
  const lines: { text: string; gapBefore: boolean }[] = [];
  let sawBlank = false;
  for (const raw of normalizeRichTextValue(value).split("\n")) {
    const text = raw.trimEnd();
    if (text.trim() === "") {
      sawBlank = true;
      continue;
    }
    const previous = lines[lines.length - 1]?.text ?? "";
    if (!(isThematicBreak(text) && isThematicBreak(previous))) {
      lines.push({ text, gapBefore: sawBlank });
    }
    sawBlank = false;
  }

  while (lines.length && isThematicBreak(lines[0].text)) lines.shift();
  while (lines.length && isThematicBreak(lines[lines.length - 1].text))
    lines.pop();

  const kept: { text: string; gapBefore: boolean }[] = [];
  let budget = maxLength;
  let wasLineCut = false;

  for (const line of lines) {
    if (kept.length === maxLines) break;

    const length = line.text.trim().length;
    if (length <= budget) {
      kept.push(line);
      budget -= length;
      continue;
    }

    // A sliver of a line reads worse than ending on the previous one.
    if (budget >= 24 || kept.length === 0) {
      kept.push({
        ...line,
        text: truncateLine(line.text, Math.max(budget, 24)),
      });
      wasLineCut = true;
    }
    break;
  }

  while (kept.length && isThematicBreak(kept[kept.length - 1].text)) kept.pop();

  const isTruncated = wasLineCut || kept.length < lines.length;
  const last = kept[kept.length - 1];
  if (isTruncated && last && !wasLineCut) {
    last.text = `${balanceInlineMarkers(last.text)}…`;
  }

  // A divider already separates what is around it, so it needs no gap.
  const text = kept
    .map(({ text, gapBefore }, index) =>
      index > 0 &&
      gapBefore &&
      !isThematicBreak(text) &&
      !isThematicBreak(kept[index - 1].text)
        ? `\n${text}`
        : text,
    )
    .join("\n");

  return { text, isTruncated };
};

export type { MarkdownPreviewOptions };
export {
  getMarkdownPreview,
  inlineMarkdownToHtml,
  isThematicBreak,
  linkClassName,
  linkTokenPattern,
  markdownToHtml,
  normalizeRichTextValue,
  parseHeadingLine,
  parseListLine,
  tiptapJsonToMarkdown,
  tokenizeLinks,
};
