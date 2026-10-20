import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductDescription } from "../components/product-description";
import { splitProductDescription } from "../lib/product-description";

test("Shopify descriptions preserve rich text, line breaks, and size tables", () => {
  const descriptionHtml = '<h2>Details</h2><p>A <strong>Ryan</strong> classic.<br>Made for introductions.</p><ul><li><em>Soft</em> fabric</li></ul><ol><li>Choose a size</li></ol><p><a href="/contact">Ask a Ryan</a></p><table><tbody><tr><th>Size</th><th>Length</th></tr><tr><td>S</td><td>28</td></tr></tbody></table>';
  const content = splitProductDescription({
    description: "Flattened description should not replace rich content.",
    descriptionHtml,
  });

  expect(content.details).toBe(descriptionHtml);
  expect(content.intro).toBe("");
  expect(content.html).toBe(true);
});

test("descriptions without HTML keep line breaks and escape literal markup", () => {
  const markup = renderToStaticMarkup(createElement(ProductDescription, {
    description: 'First paragraph.\nSecond line with <script>alert("Ryan")</script>.',
    descriptionHtml: " \n ",
    part: "intro",
  }));

  expect(markup).toContain("whitespace-pre-line");
  expect(markup).toContain("First paragraph.\nSecond line");
  expect(markup).toContain("&lt;script&gt;");
  expect(markup).not.toContain("<script>");
});

test("the introduction stays rich while all following sizing and legal content is preserved", () => {
  const intro = '<p>A <strong>Ryan</strong> classic. <a href="/contact">Ask us</a>.</p>';
  const details = '<ul><li>100% cotton</li></ul><p>Age restrictions: For adults</p><h3>Size guide</h3><table><tbody><tr><th>Size</th><td>S</td></tr></tbody></table>';
  const product = { description: "Flattened description", descriptionHtml: intro + details };
  const content = splitProductDescription(product);
  expect(content.intro).toBe(intro);
  expect(content.details).toBe(details);
  const markup = renderToStaticMarkup(createElement(ProductDescription, { ...product, part: "intro" }));
  expect(markup).toContain(intro);
  expect(markup).not.toContain("Age restrictions");
});

test("Printful descriptions split on blank lines with or without a surrounding paragraph", () => {
  const intro = "Meet your <strong>new favorite</strong> shirt.";
  const details = '• 100% cotton<br>\n<br>Disclaimers: White may appear off-white.<br>\n<br>Age restrictions: For adults';
  for (const wrapped of [false, true]) {
    const descriptionHtml = wrapped ? `<p>${intro}<br />\n<br>${details}</p><p>EU Warranty: 2 years</p>` : `${intro}<br />\n<br>${details}`;
    const content = splitProductDescription({ description: "Plain text", descriptionHtml });
    expect(content.intro).toBe(wrapped ? `<p>${intro}</p>` : intro);
    expect(content.details).toBe(wrapped ? `<p>${details}</p><p>EU Warranty: 2 years</p>` : details);
  }
});

test("formatting that spans a blank line is kept intact", () => {
  const descriptionHtml = '<p><strong>First line<br><br>Still bold</strong></p>';
  const content = splitProductDescription({ description: "First line Still bold", descriptionHtml });
  expect(content.intro + content.details).toBe(descriptionHtml);
});

test("plain-text introductions separate from details without dropping any text", () => {
  const description = "A Ryan classic.\n\nMaterials: 100% cotton.\nAge restrictions: For adults.";
  const content = splitProductDescription({ description, descriptionHtml: "" });
  expect(content.intro).toBe("A Ryan classic.");
  expect(content.intro + content.details).toBe(description);
  expect(content.html).toBe(false);
});
