import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedText } from "../src/FormattedText";

describe("FormattedText", () => {
  it("renders Markdown headings as semantic heading elements", () => {
    const markup = renderToStaticMarkup(
      <FormattedText text={"# Test heading\n\nBody text"} />,
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain(">Test heading</span></h1>");
    expect(markup).not.toContain("# Test heading");
  });

  it("turns plain HTTP URLs into safe external links when requested", () => {
    const markup = renderToStaticMarkup(
      <FormattedText
        text="See https://example.com/watch?v=one&mode=full, then reply."
        linkify
      />,
    );

    expect(markup).toContain(
      'href="https://example.com/watch?v=one&amp;mode=full"',
    );
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("</a>, then reply.");
  });

  it("leaves URLs as text unless linkification is enabled", () => {
    const markup = renderToStaticMarkup(
      <FormattedText text="https://example.com" />,
    );

    expect(markup).not.toContain("<a ");
  });
});
