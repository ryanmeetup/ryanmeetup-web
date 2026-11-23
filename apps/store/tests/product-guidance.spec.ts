import { expect, test } from "@playwright/test";
import { getProductionSummary, getSizeGuideHtml } from "../lib/product-guidance";

test("production guidance follows the maintained policy and preserves seasonal caveats", () => {
  const policy = { handle: "shipping-policy", title: "Shipping Policy", body: '<h2>Where we ship</h2><p>28 regions.</p><h2>Production time</h2><p>Allow <strong>2–7 business days</strong> before shipping.</p><p>Busy periods &amp; holidays may take longer.</p><h2>Tracking</h2><p>Tracking is emailed.</p>' };
  expect(getProductionSummary([policy])).toBe("Allow 2–7 business days before shipping. Busy periods & holidays may take longer.");
  expect(getProductionSummary([{ ...policy, body: policy.body.replace("2–7", "3–8") }])).toContain("3–8 business days");
  expect(getProductionSummary([])).toBeNull();
  expect(getProductionSummary([{ ...policy, body: "<p>Shipping varies.</p>" }])).toBeNull();
});

test("the size guide keeps both unit tables without pulling in product warnings or unrelated tables", () => {
  const inches = '<div class="table-responsive dynamic" data-unit-system="imperial"><table><tbody><tr><th>Length (inches)</th><td>28</td></tr></tbody></table></div>';
  const cm = '<div class="table-responsive dynamic" data-unit-system="metric"><table><tbody><tr><th>Length (cm)</th><td>71.1</td></tr></tbody></table></div>';
  const html = `<p>Age restrictions: For adults</p><p><strong class="size-guide-title">Size guide</strong></p>${inches}\n${cm}<p>Care instructions</p><table><tr><td>Wash cold</td></tr></table>`;
  expect(getSizeGuideHtml(html)).toBe(`${inches}\n${cm}`);
  const standalone = "<table><tbody><tr><th>Size</th><td>S</td></tr></tbody></table>";
  expect(getSizeGuideHtml(`<h3>Size guide</h3>${standalone}`)).toBe(standalone);
  expect(getSizeGuideHtml("<p>No size guide supplied.</p>" )).toBeNull();
  expect(getSizeGuideHtml("<h3>Size guide</h3><p>Ask us for measurements.</p>" )).toBeNull();
});
