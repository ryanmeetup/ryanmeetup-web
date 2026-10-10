import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedText, FormattedTextPreview } from "../src/FormattedText";

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

  it("keeps emphasis, links, and list structure when text is custom-rendered", () => {
    const markup = renderToStaticMarkup(
      <FormattedText
        text={"- **Ship RMT-5** first\n- see https://example.com/a_b_c"}
        linkify
        renderText={(text) => text.replace("RMT-5", "[RMT-5]")}
      />,
    );

    expect(markup).toContain("<strong>Ship [RMT-5]</strong>");
    expect(markup).toContain('href="https://example.com/a_b_c"');
    expect(markup).not.toContain("<em>");
    expect(markup.match(/•/g)).toHaveLength(2);
  });

  it("renders compact headings as emphasized lines", () => {
    const markup = renderToStaticMarkup(
      <FormattedText compact text={"# Plan\nBody"} />,
    );

    expect(markup).not.toContain("<h1");
    expect(markup).toContain('<p class="font-semibold"><span>Plan</span></p>');
  });
});

describe("FormattedTextPreview", () => {
  it("renders a shortened list as list rows rather than a run-on string", () => {
    const markup = renderToStaticMarkup(
      <FormattedTextPreview
        text={"See below.\n\n---\n- First thing\n- Second thing\n- Third"}
        maxLines={4}
      />,
    );

    expect(markup).toContain("See below.");
    expect(markup).toContain("<hr");
    expect(markup.match(/•/g)).toHaveLength(2);
    expect(markup).toContain("Second thing…");
    expect(markup).not.toContain("Third");
  });
});
