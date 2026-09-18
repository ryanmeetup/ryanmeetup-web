import { Fragment } from "react";
import {
  inlineMarkdownToHtml,
  normalizeRichTextValue,
  parseHeadingLine,
  parseListLine,
} from "./richTextMarkdown";

export type FormattedTextProps = {
  text: string;
  className?: string;
  onChange?: (value: string) => void;
  linkify?: boolean;
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

const FormattedText = ({
  text,
  className,
  onChange,
  linkify = false,
}: FormattedTextProps) => {
  const normalized = normalizeRichTextValue(text);
  const lines = normalized.split("\n");

  return (
    <div className={className}>
      {lines.map((line, index) => {
        const heading = parseHeadingLine(line);
        if (heading) {
          const content = (
            <span
              dangerouslySetInnerHTML={{
                __html: inlineMarkdownToHtml(heading.text, { linkify }),
              }}
            />
          );
          const headingClassName = headingClasses[heading.level - 1];
          switch (heading.level) {
            case 1:
              return (
                <h1 key={index} className={headingClassName}>
                  {content}
                </h1>
              );
            case 2:
              return (
                <h2 key={index} className={headingClassName}>
                  {content}
                </h2>
              );
            case 3:
              return (
                <h3 key={index} className={headingClassName}>
                  {content}
                </h3>
              );
            case 4:
              return (
                <h4 key={index} className={headingClassName}>
                  {content}
                </h4>
              );
            case 5:
              return (
                <h5 key={index} className={headingClassName}>
                  {content}
                </h5>
              );
            default:
              return (
                <h6 key={index} className={headingClassName}>
                  {content}
                </h6>
              );
          }
        }
        if (/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(line))
          return (
            <hr
              key={index}
              className="my-3 border-0 border-t border-zinc-600"
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
                className={
                  checked ? "text-black/50 line-through dark:text-white/50" : ""
                }
                dangerouslySetInnerHTML={{
                  __html: inlineMarkdownToHtml(listItem.text, { linkify }),
                }}
              />
            </div>
          );
        }
        return (
          <Fragment key={index}>
            <span
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: inlineMarkdownToHtml(line, { linkify }),
              }}
            />
            {index < lines.length - 1 && <br />}
          </Fragment>
        );
      })}
    </div>
  );
};

export { FormattedText };
