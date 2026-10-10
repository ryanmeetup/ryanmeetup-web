import { describe, expect, it } from "vitest";
import {
  getMarkdownPreview,
  markdownToHtml,
  parseHeadingLine,
  tiptapJsonToMarkdown,
} from "../src/richTextMarkdown";

describe("rich text Markdown", () => {
  it("renders an empty value as a truly empty editor paragraph", () => {
    expect(markdownToHtml("")).toBe("<p></p>");
  });

  it("parses ATX headings at every supported level", () => {
    expect(parseHeadingLine("# Test heading")).toEqual({
      level: 1,
      text: "Test heading",
    });
    expect(parseHeadingLine("###### Small heading")).toEqual({
      level: 6,
      text: "Small heading",
    });
    expect(markdownToHtml("# Test heading")).toBe("<h1>Test heading</h1>");
  });

  it("serializes heading nodes back to Markdown", () => {
    expect(
      tiptapJsonToMarkdown({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Other notes" }],
          },
        ],
      }),
    ).toBe("## Other notes");
  });

  it("keeps intentional blank lines as empty editor paragraphs", () => {
    const markdown = "First paragraph\n\n# Other notes";
    expect(markdownToHtml(markdown)).toBe(
      "<p>First paragraph</p><p><br></p><h1>Other notes</h1>",
    );
    expect(
      tiptapJsonToMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First paragraph" }],
          },
          { type: "paragraph" },
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Other notes" }],
          },
        ],
      }),
    ).toBe(markdown);
  });

  it("does not collapse blank lines between list blocks", () => {
    expect(markdownToHtml("- First item\n\n- Second item")).toBe(
      "<ul><li><p>First item</p></li></ul><p><br></p><ul><li><p>Second item</p></li></ul>",
    );
  });
});

describe("getMarkdownPreview", () => {
  it("keeps whole lines so list markers survive", () => {
    expect(
      getMarkdownPreview("- One\n- Two\n- Three\n- Four", { maxLines: 2 }),
    ).toEqual({ text: "- One\n- Two…", isTruncated: true });
  });

  it("collapses blank lines and drops leading or trailing dividers", () => {
    expect(getMarkdownPreview("---\n\nIntro\n\n---\n\n---")).toEqual({
      text: "Intro",
      isTruncated: false,
    });
  });

  it("cuts only the last line, at a word, without a stray marker", () => {
    const { text, isTruncated } = getMarkdownPreview(
      "**A long bold sentence that keeps on going well past the budget**",
      { maxLength: 30 },
    );

    expect(isTruncated).toBe(true);
    expect(text).toBe("A long bold sentence that…");
  });

  it("keeps one paragraph gap without spending a line on it", () => {
    expect(
      getMarkdownPreview("Intro\n\n\n- One\n- Two\n- Three", { maxLines: 3 }),
    ).toEqual({ text: "Intro\n\n- One\n- Two…", isTruncated: true });
  });

  it("leaves short text untouched", () => {
    expect(getMarkdownPreview("Short note")).toEqual({
      text: "Short note",
      isTruncated: false,
    });
  });
});
