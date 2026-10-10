import { Fragment, type ReactNode } from "react";
import {
  getMarkdownPreview,
  isThematicBreak,
  linkClassName,
  linkTokenPattern,
  normalizeRichTextValue,
  parseHeadingLine,
  parseListLine,
  tokenizeLinks,
  type MarkdownPreviewOptions,
} from "./richTextMarkdown";

export type FormattedTextProps = {
  text: string;
  className?: string;
  onChange?: (value: string) => void;
  linkify?: boolean;
  /**
   * Tightens block spacing and renders headings as emphasized lines, for
   * previews, comments, and other dense surfaces.
   */
  compact?: boolean;
  /**
   * Renders each run of plain text, after emphasis and links are parsed. Use it
   * to turn references inside the text into links without losing formatting.
   */
  renderText?: (text: string) => ReactNode;
};

const bullets = ["•", "◦", "▪", "▫"];
const headingClasses = [
  "text-xl font-bold",
  "text-lg font-bold",
  "text-base font-semibold",
  "text-sm font-semibold",
  "text-sm font-semibold",
  "text-xs font-semibold uppercase tracking-wider",
];
const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

const emphasisPattern =
  /(\*\*\*[^*\n]+\*\*\*|___[^_\n]+___|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

const plainText = (text: string) => text;

function renderInlineMarkdown(
  value: string,
  {
    linkify,
    renderText,
  }: { linkify: boolean; renderText: (text: string) => ReactNode },
) {
  const { links, tokenized } = linkify
    ? tokenizeLinks(value)
    : { links: [] as string[], tokenized: value };

  // Splitting on the placeholder's captured index leaves text at even
  // positions and link indexes at odd ones.
  const renderLeaf = (text: string, key: string): ReactNode[] =>
    text.split(linkTokenPattern).map((part, index) => {
      if (index % 2 === 1) {
        const href = links[Number(part)];
        return (
          <a
            key={`${key}-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {href}
          </a>
        );
      }
      if (part === "") return null;
      return <Fragment key={`${key}-${index}`}>{renderText(part)}</Fragment>;
    });

  const renderEmphasis = (text: string, key: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(emphasisPattern)) {
      const token = match[0];
      const tokenKey = `${key}-${match.index}`;
      if (match.index > lastIndex) {
        nodes.push(
          ...renderLeaf(text.slice(lastIndex, match.index), `${tokenKey}t`),
        );
      }
      const width = /^(\*\*\*|___)/.test(token)
        ? 3
        : /^(\*\*|__)/.test(token)
          ? 2
          : 1;
      const inner = renderEmphasis(token.slice(width, -width), tokenKey);
      nodes.push(
        width === 3 ? (
          <em key={tokenKey}>
            <strong>{inner}</strong>
          </em>
        ) : width === 2 ? (
          <strong key={tokenKey}>{inner}</strong>
        ) : (
          <em key={tokenKey}>{inner}</em>
        ),
      );
      lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
      nodes.push(...renderLeaf(text.slice(lastIndex), `${key}-end`));
    }
    return nodes;
  };

  return renderEmphasis(tokenized, "i");
}

const FormattedText = ({
  text,
  className,
  onChange,
  linkify = false,
  compact = false,
  renderText = plainText,
}: FormattedTextProps) => {
  const normalized = normalizeRichTextValue(text);
  const lines = normalized.split("\n");
  const inline = (value: string) =>
    renderInlineMarkdown(value, { linkify, renderText });

  return (
    <div className={className}>
      {lines.map((line, index) => {
        const heading = parseHeadingLine(line);
        if (heading) {
          const content = <span>{inline(heading.text)}</span>;
          if (compact) {
            return (
              <p key={index} className="font-semibold">
                {content}
              </p>
            );
          }
          const Heading = headingTags[heading.level - 1];
          return (
            <Heading key={index} className={headingClasses[heading.level - 1]}>
              {content}
            </Heading>
          );
        }
        if (isThematicBreak(line))
          return (
            <hr
              key={index}
              className={`${compact ? "my-1.5" : "my-3"} border-0 border-t border-zinc-600`}
            />
          );
        const listItem = parseListLine(line);
        if (listItem) {
          const taskMatch = line.match(/\[([ xX])\]/);
          const task = Boolean(taskMatch);
          const checked = taskMatch?.[1].toLowerCase() === "x";
          const marker = task
            ? null
            : /^\s*\d+\./.test(line)
              ? line.match(/^\s*(\d+\.)/)?.[1]
              : bullets[listItem.depth % bullets.length];
          return (
            <div
              key={index}
              className="flex items-start gap-2"
              style={{ paddingLeft: `${listItem.depth * 1.25}rem` }}
            >
              {task ? (
                onChange ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = [...lines];
                      next[index] = line.replace(
                        /\[[ xX]\]/,
                        checked ? "[ ]" : "[x]",
                      );
                      onChange(next.join("\n"));
                    }}
                    className="mt-1 h-4 w-4 accent-zinc-100"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                      checked
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-black/50 dark:border-white/50"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                )
              ) : (
                <span aria-hidden className="w-4 shrink-0 text-center">
                  {marker}
                </span>
              )}
              <span
                className={`min-w-0 break-words ${
                  checked ? "text-black/50 line-through dark:text-white/50" : ""
                }`}
              >
                {inline(listItem.text)}
              </span>
            </div>
          );
        }
        return (
          <Fragment key={index}>
            <span className="whitespace-pre-wrap">{inline(line)}</span>
            {index < lines.length - 1 && <br />}
          </Fragment>
        );
      })}
    </div>
  );
};

export type FormattedTextPreviewProps = Omit<
  FormattedTextProps,
  "compact" | "onChange"
> &
  MarkdownPreviewOptions;

/**
 * Read-only snippet of stored Markdown for cards and lists. It shortens by
 * whole lines, so bullets, checklists, and dividers keep rendering as
 * structure. Clamping a formatted block with `line-clamp` cannot do that: list
 * rows are flex containers, which the clamp does not count, so a list either
 * shows in full or is cut off with no ellipsis.
 */
const FormattedTextPreview = ({
  text,
  maxLength,
  maxLines,
  ...props
}: FormattedTextPreviewProps) => (
  <FormattedText
    {...props}
    compact
    text={getMarkdownPreview(text, { maxLength, maxLines }).text}
  />
);

export { FormattedText, FormattedTextPreview };
