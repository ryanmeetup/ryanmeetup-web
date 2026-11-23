import { expect, test } from "@playwright/test";
import { describeShippingRegions, getProductionSummary, getShippingExpectations, getSizeGuideHtml, getSizeGuideTables, mergeSizeGuideUnits } from "../lib/product-guidance";

test("production guidance follows the maintained policy and preserves seasonal caveats", () => {
  const policy = { handle: "shipping-policy", title: "Shipping Policy", body: '<h2>Where we ship</h2><p>28 regions.</p><h2>Production time</h2><p>Allow <strong>2–7 business days</strong> before shipping.</p><p>Busy periods &amp; holidays may take longer.</p><h2>Tracking</h2><p>Tracking is emailed.</p>' };
  expect(getProductionSummary([policy])).toBe("Allow 2–7 business days before shipping. Busy periods & holidays may take longer.");
  expect(getProductionSummary([{ ...policy, body: policy.body.replace("2–7", "3–8") }])).toContain("3–8 business days");
  expect(getProductionSummary([])).toBeNull();
  expect(getProductionSummary([{ ...policy, body: "<p>Shipping varies.</p>" }])).toBeNull();
});

test("shipping expectations come from the policy and checkout countries, never from guesses", () => {
  const body = "<h2>Where we ship</h2><p>28 regions.</p><h2>Production time</h2><p>Please allow 2 - 7 business days for it to be produced.</p><p>Production can take longer during the holidays.</p><h2>Tracking</h2><p>We email a tracking link.</p>";
  const policy = { handle: "shipping-policy", title: "Shipping Policy", body };
  expect(getShippingExpectations([policy], ["US", "CA", "GB", "CA"])).toEqual([
    { id: "production", title: "Made to order", detail: "2–7 business days to make, longer around the holidays" },
    { id: "countries", title: "Ships to 3 countries and regions", detail: "Shipping costs shown at checkout" },
    { id: "tracking", title: "Tracking by email", detail: "Sent as soon as it ships" },
  ]);
  const plain = { ...policy, body: body.replace("<p>Production can take longer during the holidays.</p>", "") };
  expect(getShippingExpectations([plain], ["US"]).map(({ title, detail }) => `${title}: ${detail}`)).toEqual([
    "Made to order: 2–7 business days to make, then it ships",
    "Ships within the United States: Shipping costs shown at checkout",
    "Tracking by email: Sent as soon as it ships",
  ]);
  // No range in the policy, no policy at all, or no countries: only the always-true production line remains.
  const vague = { ...policy, body: "<h2>Production time</h2><p>Made when you order.</p>" };
  expect(getShippingExpectations([vague], [])).toEqual([{ id: "production", title: "Made to order", detail: "Made for you, then it ships" }]);
  expect(getShippingExpectations([], [])).toEqual([{ id: "production", title: "Made to order", detail: "Made for you, then it ships" }]);
});

test("the product page's country line counts checkout's countries once and names a single one", () => {
  expect(describeShippingRegions(["US", "CA", "CA", "JP"])).toBe("Ships to 3 countries and regions");
  expect(describeShippingRegions(["US"])).toBe("Ships within the United States");
  expect(describeShippingRegions(["CA"])).toBe("Ships within Canada");
  expect(describeShippingRegions([])).toBeNull();
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

test("the size guide offers centimetres, converting the inch table when Shopify has no metric one", () => {
  const inches = '<div class="table-responsive dynamic" data-unit-system="imperial"><table><tbody><tr><td> </td><td><strong>LENGTH (inches)</strong></td></tr><tr><td><strong>2XL</strong></td><td>15 ⅝</td></tr><tr><td><strong>3XL</strong></td><td>28 - 30</td></tr></tbody></table></div>';
  const cm = '<div class="table-responsive dynamic" data-unit-system="metric"><table><tbody><tr><th>Length (cm)</th><td>71.1</td></tr></tbody></table></div>';
  expect(getSizeGuideTables(`${inches}\n${cm}`)).toEqual({ inches, centimeters: cm });
  expect(getSizeGuideTables(inches).centimeters).toBe('<div class="table-responsive dynamic" data-unit-system="imperial"><table><tbody><tr><td> </td><td><strong>LENGTH (cm)</strong></td></tr><tr><td><strong>2XL</strong></td><td>39.7</td></tr><tr><td><strong>3XL</strong></td><td>71.1 - 76.2</td></tr></tbody></table></div>');
  expect(getSizeGuideTables("<table><tr><td>S</td><td>28</td></tr></table>")).toEqual({ inches: "<table><tr><td>S</td><td>28</td></tr></table>", centimeters: null });
});

test("both size guide units share one table so columns hold their width", () => {
  const inches = "<table><tr><td>S</td><td>28</td></tr></table>";
  const centimeters = "<table><tr><td>S</td><td>71.1</td></tr></table>";
  expect(mergeSizeGuideUnits({ inches, centimeters }, "centimeters")).toBe('<table><tr><td>S</td><td><span class="grid"><span class="col-start-1 row-start-1 invisible" aria-hidden="true">28</span><span class="col-start-1 row-start-1">71.1</span></span></td></tr></table>');
  expect(mergeSizeGuideUnits({ inches, centimeters: "<table><tr><td>71.1</td></tr></table>" }, "inches")).toBeNull();
  expect(mergeSizeGuideUnits({ inches, centimeters: null }, "inches")).toBeNull();
});
