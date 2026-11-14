import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const certifyNotABryan = async (page: Page) => {
  await page.getByText("I certify my name is not Bryan or Brian.").click();
  await page.getByRole("button", { name: "Continue" }).click();
};

test.describe("sponsorship program", () => {
  test("sponsors introduces the current program and hands prospects to partnerships", async ({
    page,
  }) => {
    await page.goto("/sponsors");
    await certifyNotABryan(page);

    await expect(
      page.getByRole("heading", { name: "Help Power Ryan Meetup" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View partnership details" }),
    ).toHaveAttribute("href", "/sponsors/partnerships");
    await expect(
      page.getByRole("heading", { name: "Pick the support level that fits" }),
    ).toHaveCount(0);
  });

  test("each tier CTA opens the contact form prefilled with that tier", async ({
    page,
  }) => {
    await page.goto("/sponsors/partnerships");
    await certifyNotABryan(page);

    const cta = page.getByRole("link", {
      name: "Back the Operations Partner tier",
    });
    await cta.click();

    await expect(page).toHaveURL(/topic=sponsorship/);
    await expect(page).toHaveURL(/detail=monthly-backer/);
    await expect(page.getByLabel("Subject")).toHaveValue(
      "Sponsorship Inquiry: Operations Partner ($250/month)",
    );
    await expect(page.getByLabel("Message")).toHaveValue(
      /Monthly Backer at the Operations Partner \(\$250\/month\) tier\./,
    );
  });

  test("visitors who have not picked a tier still get the generic intake", async ({
    page,
  }) => {
    await page.goto("/sponsors/partnerships");
    await certifyNotABryan(page);

    const cta = page.getByRole("link", { name: "Ask a Ryan" });
    await expect(cta).toHaveAttribute(
      "href",
      "/contact?topic=sponsorship&detail=monthly-backer&source=partnerships",
    );
    await cta.click();

    await expect(page.getByLabel("Subject")).toHaveValue(
      "Sponsorship Inquiry: Become a Monthly Backer",
    );
    await expect(page.getByLabel("Message")).toHaveValue(
      /Tier I'm considering \(\$100 \/ \$250 \/ \$500\):/,
    );
  });

  test("partnerships route separates monthly and custom paths", async ({
    page,
  }) => {
    await page.goto("/sponsors/partnerships");

    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText("Sponsors/Sponsorship Details");
    await certifyNotABryan(page);

    await expect(
      page.getByRole("heading", { name: "Sponsorship Options" }),
    ).toBeVisible();
    const options = page.getByRole("complementary", {
      name: "Sponsorship options",
    });
    await expect(options.getByText("Starting at")).toBeVisible();
    await expect(options.getByText("$100", { exact: true })).toBeVisible();
    await expect(options.getByText("/month", { exact: true })).toBeVisible();
    await expect(page.getByText("Scoped and priced together")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "What are we building?" }),
    ).toBeVisible();
    await expect(page.getByText("Typically includes")).toHaveCount(2);
    await expect(
      page.getByText(
        "A verbal thank-you to the room from the Ryan running the event",
      ),
    ).toBeVisible();
    await expect(page.getByText(/stunt/i)).toHaveCount(0);
    await expect(page.getByText(/main event/i)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Pick the support level that fits" }),
    ).toBeVisible();
  });

  test("the intake asks for the idea without a budget gate", async ({
    page,
  }) => {
    await page.goto("/sponsors/partnerships#partnership-intake");
    await certifyNotABryan(page);

    const intake = page.getByRole("region", {
      name: "Tell us what the brand wants to accomplish",
    });
    await expect(intake.getByText("Working budget")).toHaveCount(0);
    await expect(
      intake.getByRole("link", { name: "Explore Monthly Backers" }),
    ).toHaveAttribute("href", "/sponsors/partnerships#monthly-backers");

    await expect(page.getByLabel("Brand or company name")).toBeVisible();
    await expect(page.getByLabel("Brand website")).toBeVisible();
    await expect(page.getByLabel("Work email")).toHaveAttribute("required", "");
    await expect(page.getByLabel("What do you want to build?")).toHaveAttribute(
      "required",
      "",
    );
  });

  test("collaboration inquiries can be submitted", async ({ page }) => {
    await page.goto("/sponsors/partnerships#partnership-intake");
    await certifyNotABryan(page);

    await page.getByRole("button", { name: /Desired integration/ }).click();
    await page.getByRole("option", { name: "Event Sponsorship" }).click();

    await page.getByLabel("Brand or company name").fill("Ryan & Sons");
    await page.getByLabel("Brand website").fill("example.com");
    await page.getByLabel("First name").fill("Ryan");
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Work email").fill("ryan@example.com");
    await page.getByLabel("Desired timing").fill("Fall 2026");
    await page
      .getByLabel("What do you want to build?")
      .fill("Create a memorable community event for local Ryans.");
    await page
      .getByRole("button", { name: "Send collaboration inquiry" })
      .click();

    await expect(page.getByText("Inquiry sent!")).toBeVisible();
    // Every toast can be closed rather than left to time out over the page.
    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(page.getByText("Inquiry sent!")).toBeHidden();
  });
});
