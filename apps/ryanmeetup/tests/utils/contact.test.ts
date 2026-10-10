import { expect, test } from "@playwright/test";

import {
  buildContactHref,
  buildMonthlyBackerTierHref,
  contactHrefs,
  contactTopics,
} from "@/utils/contact";
import { monthlyBackerTiers } from "@/lib/sponsorship-program";

const findTopic = (value: string) =>
  contactTopics.find((topic) => topic.value === value);

test.describe("contact topics", () => {
  test("topic and detail slugs are unique", () => {
    const values = contactTopics.map((topic) => topic.value);
    expect(new Set(values).size).toBe(values.length);

    for (const topic of contactTopics) {
      const details = topic.detail?.options.map((option) => option.value) ?? [];
      expect(new Set(details).size).toBe(details.length);
    }
  });

  test("every topic can seed a subject and route somewhere", () => {
    for (const topic of contactTopics) {
      expect(topic.subject).not.toBe("");
      expect(topic.routeTo).toMatch(/@/);
    }
  });

  test("buildContactHref encodes topic, detail, and source", () => {
    expect(buildContactHref("chapters")).toBe("/contact?topic=chapters");
    expect(
      buildContactHref("chapters", {
        detail: "chapter-question",
        source: "chapter:San Diego",
      }),
    ).toBe(
      "/contact?topic=chapters&detail=chapter-question&source=chapter%3ASan+Diego",
    );
  });

  test("prebuilt CTA links point at real topics and details", () => {
    for (const href of Object.values(contactHrefs)) {
      const params = new URLSearchParams(href.split("?")[1]);
      const topic = findTopic(params.get("topic") ?? "");
      expect(topic, `unknown topic in ${href}`).toBeTruthy();

      const detail = params.get("detail");
      if (detail) {
        const options = topic?.detail?.options ?? [];
        expect(
          options.some((option) => option.value === detail),
          `unknown detail in ${href}`,
        ).toBe(true);
      }
    }
  });

  test("sponsorship CTA links keep topic, detail, and source synchronized", () => {
    expect(contactHrefs.monthlyBacker).toBe(
      "/contact?topic=sponsorship&detail=monthly-backer&source=sponsors",
    );
    expect(contactHrefs.partnershipsMonthlyBacker).toBe(
      "/contact?topic=sponsorship&detail=monthly-backer&source=partnerships",
    );
    expect(contactHrefs.eventSponsorship).toBe(
      "/contact?topic=sponsorship&detail=event-sponsorship&source=partnerships",
    );
    expect(contactHrefs.brandCollaboration).toBe(
      "/contact?topic=sponsorship&detail=brand-collaboration&source=partnerships",
    );
  });

  test("join-the-team roles route chapter leads and ask about specific roles", () => {
    const options = findTopic("join-team")?.detail?.options ?? [];
    const option = (value: string) =>
      options.find((candidate) => candidate.value === value);

    expect(option("chapter-lead")?.routeTo).toBe("chapters@ryanmeetup.com");
    expect(option("core-team")).toBeTruthy();
    expect(option("other-help")?.followUp?.label).toBe(
      "What role do you have in mind?",
    );
    expect(options.filter((candidate) => candidate.followUp)).toHaveLength(1);
  });

  test("Monthly Backer inquiries seed tier-specific form content", () => {
    const sponsorship = findTopic("sponsorship");
    const monthlyBacker = sponsorship?.detail?.options.find(
      (option) => option.value === "monthly-backer",
    );

    expect(monthlyBacker?.message).toContain(
      "Tier I'm considering ($100 / $250 / $500):",
    );
    expect(monthlyBacker?.messagePlaceholder).toContain("preferred tier");
  });

  test("each tier CTA prefills its own subject, message, and source", () => {
    for (const tier of monthlyBackerTiers) {
      const params = new URLSearchParams(
        buildMonthlyBackerTierHref(tier.slug).split("?")[1],
      );

      expect(params.get("topic")).toBe("sponsorship");
      expect(params.get("detail")).toBe("monthly-backer");
      expect(params.get("source")).toBe(`partnerships:${tier.slug}`);
      expect(params.get("subject")).toBe(
        `Sponsorship Inquiry: ${tier.name} ($${tier.price}/month)`,
      );
      expect(params.get("message")).toContain(
        `Monthly Backer at the ${tier.name} ($${tier.price}/month) tier.`,
      );
      expect(params.get("message")).toContain("Brand/company:");
    }
  });
});
