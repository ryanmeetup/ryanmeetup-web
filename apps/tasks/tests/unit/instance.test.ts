import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/instance.ts` reads its environment once at module load, so each case
 * re-imports it under the environment being exercised.
 */
async function loadInstance(env: Record<string, string> = {}) {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("@/lib/instance");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("instance identity", () => {
  it("presents as an unnamed workspace when nothing is configured", async () => {
    const { instanceBuild, instanceDefaults, instancePageTitle } =
      await loadInstance();
    const instance = instanceDefaults;

    expect(instance.name).toBe("Workspace");
    expect(instanceBuild.taskKeyPrefix).toBe("TASK");
    expect(instanceBuild.changelogVersionPrefix).toBe("TASK");
    expect(instance.accentColor).toBe("#ee1a25");
    expect(instance.monogram).toBe("W");
    expect(instance.logoPath).toBeNull();
    expect(instance.description).toBe(
      "A shared workspace for planning projects, assigning tasks, and keeping work moving.",
    );
    expect(instance.ogAlt).toBe("Workspace — private team workspace");
    // No organization is named, so there is nothing to put under the wordmark
    // and no accounts to link.
    expect(instance.footerSubtitle).toBe("");
    expect(instance.footerSocials).toEqual([]);
    expect(instancePageTitle(instance, "Dashboard")).toBe(
      "Dashboard | Workspace",
    );
  });

  it("carries no Ryan Meetup identity in the compiled defaults", async () => {
    const { instanceDefaults } = await loadInstance();
    const identity = [
      instanceDefaults.name,
      instanceDefaults.description,
      instanceDefaults.footerSubtitle,
      instanceDefaults.ogAlt,
      ...instanceDefaults.footerSocials.map((social) => social.url),
    ].join(" ");

    expect(identity).not.toMatch(/ryan meetup|bryans|ryanmeetup/i);
  });

  it("wears the Ryan Meetup identity only when configured to", async () => {
    const instance = (
      await loadInstance({
        NEXT_PUBLIC_INSTANCE_NAME: "Ryan Meetup",
        NEXT_PUBLIC_INSTANCE_FOOTER_SUBTITLE: "NO BRYANS ALLOWED",
      })
    ).instanceDefaults;

    expect(instance.name).toBe("Ryan Meetup");
    expect(instance.monogram).toBe("R");
    expect(instance.footerSubtitle).toBe("NO BRYANS ALLOWED");
    expect(instance.description).toBe(
      "The private workspace for the Ryan Meetup core team to plan projects and keep work moving.",
    );
  });

  it("derives the description, monogram, and titles from the instance name", async () => {
    const { instanceDefaults: instance, instancePageTitle } =
      await loadInstance({ NEXT_PUBLIC_INSTANCE_NAME: "Ryan Le" });

    expect(instance.monogram).toBe("R");
    expect(instance.description).toContain("Ryan Le core team");
    // The instance name is the only name: it titles every page on its own,
    // with no separate product name after it.
    expect(instancePageTitle(instance, "Notes")).toBe("Notes | Ryan Le");
  });

  it("keeps neutral task keys for a configured deployment", async () => {
    const { instanceBuild } = await loadInstance({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    // Configuring Supabase says nothing about who the instance is, so the
    // prefix stays neutral until the instance names one.
    expect(instanceBuild.taskKeyPrefix).toBe("TASK");
    expect(instanceBuild.changelogVersionPrefix).toBe("TASK");
  });

  it("takes the instance's own key prefix when it sets one", async () => {
    const { instanceBuild } = await loadInstance({
      NEXT_PUBLIC_TASK_KEY_PREFIX: "rmt",
    });

    // Upper-cased on the way in, and the changelog follows it by default.
    expect(instanceBuild.taskKeyPrefix).toBe("RMT");
    expect(instanceBuild.changelogVersionPrefix).toBe("RMT");
  });

  it("lets an instance override every derived value", async () => {
    const { instanceDefaults: instance } = await loadInstance({
      NEXT_PUBLIC_INSTANCE_NAME: "Ryan Le",
      NEXT_PUBLIC_INSTANCE_DESCRIPTION: "My own projects.",
      NEXT_PUBLIC_INSTANCE_MONOGRAM: "L",
      NEXT_PUBLIC_INSTANCE_ACCENT: "#0f766e",
      NEXT_PUBLIC_INSTANCE_LOGO_PATH: "/instance-logo.svg",
    });

    expect(instance.description).toBe("My own projects.");
    expect(instance.monogram).toBe("L");
    expect(instance.accentColor).toBe("#0f766e");
    expect(instance.logoPath).toBe("/instance-logo.svg");
  });

  it("provides neutral branding for the zero-configuration demo", async () => {
    const { demoInstanceSettings } = await loadInstance();

    expect(demoInstanceSettings).toMatchObject({
      name: "Workspace",
      footerSections: [],
      footerSocials: [],
    });
    expect(JSON.stringify(demoInstanceSettings)).not.toMatch(
      /ryan meetup|ryancon/i,
    );
  });

  it("keeps the build credit in the demo, where the organization goes neutral", async () => {
    // Neutral branding is about whose workspace this is. The credit is about
    // who wrote the software, which the demo does not change.
    const { demoInstanceSettings, instanceDefaults } = await loadInstance();

    expect(demoInstanceSettings.creditPrefix).toBe(
      instanceDefaults.creditPrefix,
    );
    expect(demoInstanceSettings.creditLabel).toBe(instanceDefaults.creditLabel);
    expect(demoInstanceSettings.creditUrl).toBe(instanceDefaults.creditUrl);
    expect(demoInstanceSettings.creditSuffix).toBe(
      instanceDefaults.creditSuffix,
    );
  });

  it("rejects configuration that would corrupt a pattern, style, or asset URL", async () => {
    await expect(
      loadInstance({ NEXT_PUBLIC_TASK_KEY_PREFIX: "rm-t" }),
    ).rejects.toThrow(/TASK_KEY_PREFIX/);
    await expect(
      loadInstance({ NEXT_PUBLIC_INSTANCE_ACCENT: "red" }),
    ).rejects.toThrow(/ACCENT/);
    await expect(
      loadInstance({
        NEXT_PUBLIC_INSTANCE_LOGO_PATH: "//evil.example/logo.svg",
      }),
    ).rejects.toThrow(/LOGO_PATH/);
  });
});

describe("instance-scoped task keys", () => {
  it("builds, parses, and links task keys with the configured prefix", async () => {
    await loadInstance({ NEXT_PUBLIC_TASK_KEY_PREFIX: "prs" });
    const { taskKey, taskPath, parseTaskKey } =
      await import("@/lib/tasks/task-key");

    expect(taskKey({ task_number: 12 })).toBe("PRS-12");
    expect(taskPath({ task_number: 12 })).toBe("/task/PRS-12");
    expect(parseTaskKey("prs-12")).toBe(12);
    expect(parseTaskKey("RMT-12")).toBeNull();
  });

  it("resolves comment references against the configured prefix", async () => {
    await loadInstance({ NEXT_PUBLIC_TASK_KEY_PREFIX: "PRS" });
    const { taskCommentSegments } =
      await import("@/lib/tasks/task-comment-references");
    const tasks = [{ id: "task-7", task_number: 7, project_id: null }];

    expect(taskCommentSegments("Blocked by PRS-7, not RMT-7.", tasks)).toEqual([
      { kind: "text", value: "Blocked by " },
      { kind: "task", task: tasks[0], value: "PRS-7" },
      { kind: "text", value: ", not RMT-7." },
    ]);
  });
});

describe("instance-scoped changelog versions", () => {
  it("renders release numbers under the task key prefix by default", async () => {
    await loadInstance({ NEXT_PUBLIC_TASK_KEY_PREFIX: "PRS" });
    const { changelog, latestChangelogRelease } =
      await import("@/lib/server/changelog");

    expect(latestChangelogRelease.version).toBe("PRS v0.9.0");
    expect(latestChangelogRelease.releaseVersion).toBe("0.9.0");
    expect(changelog.map((release) => release.version)).toEqual([
      "PRS v0.9.0",
      "PRS v0.8.1",
      "PRS v0.8.0",
      "PRS v0.7.0",
      "PRS v0.6.0",
      "PRS v0.5.0",
      "PRS v0.4.0",
      "PRS v0.3.0",
      "PRS v0.2.0",
      "PRS v0.1.0",
    ]);
  });

  it("allows a changelog prefix that differs from the task key prefix", async () => {
    await loadInstance({
      NEXT_PUBLIC_TASK_KEY_PREFIX: "PRS",
      NEXT_PUBLIC_CHANGELOG_VERSION_PREFIX: "Workspace",
    });
    const { latestChangelogRelease } = await import("@/lib/server/changelog");

    expect(latestChangelogRelease.version).toBe("Workspace v0.9.0");
  });
});

/**
 * The Open Graph route and the admin preview render the same card through two
 * different engines, so these helpers are the only thing keeping the owner's
 * preview honest about the image other apps fetch.
 */
describe("link preview card fitting", () => {
  it("prints a description that fits as it was written", async () => {
    const { ogCardDescription } = await loadInstance();
    const short = "Where the Acme team plans projects and tracks work.";

    expect(ogCardDescription(short)).toBe(short);
  });

  it("cuts a long description back to a word boundary", async () => {
    const { ogCardDescription } = await loadInstance();
    const long = `${"word ".repeat(60)}end`;
    const fitted = ogCardDescription(long);

    expect(fitted.length).toBeLessThanOrEqual(151);
    expect(fitted.endsWith("…")).toBe(true);
    // Cut between words, never mid-word and never leaving a dangling space.
    expect(fitted).not.toMatch(/\s…$/);
    expect(fitted.slice(0, -1).split(" ").at(-1)).toBe("word");
  });

  it("drops trailing punctuation left behind by the cut", async () => {
    const { ogCardDescription } = await loadInstance();

    expect(ogCardDescription("Plan work, assign it, ship it.", 15)).toBe(
      "Plan work…",
    );
  });

  it("shrinks the name as it gets longer, so it stays on the card", async () => {
    const { ogCardNameScale } = await loadInstance();

    expect(ogCardNameScale("Ryan Meetup")).toBe(1);
    expect(ogCardNameScale("Acme Collective")).toBeLessThan(1);
    expect(ogCardNameScale("The Northern Districts Collective")).toBeLessThan(
      ogCardNameScale("Acme Collective"),
    );
  });
});

describe("runtime instance overrides", () => {
  it("layers stored values over the compiled defaults", async () => {
    const { instanceDefaults, resolveInstanceSettings } = await loadInstance();

    expect(
      resolveInstanceSettings({ name: "Ryan Le", accentColor: "#0f766e" }),
    ).toMatchObject({
      name: "Ryan Le",
      accentColor: "#0f766e",
      // Untouched keys keep the compiled default, including derived ones.
      monogram: instanceDefaults.monogram,
      footerSubtitle: instanceDefaults.footerSubtitle,
    });
  });

  it("falls back to the default when no row is stored", async () => {
    const { demoInstanceSettings, instanceDefaults, resolveInstanceSettings } =
      await loadInstance();

    expect(resolveInstanceSettings(null)).toEqual(instanceDefaults);
    expect(resolveInstanceSettings({})).toEqual(instanceDefaults);
    expect(resolveInstanceSettings(null, demoInstanceSettings)).toEqual(
      demoInstanceSettings,
    );
  });

  it("honours an explicit null only for values that may be empty", async () => {
    const { instanceDefaults, resolveInstanceSettings } = await loadInstance();
    const resolved = resolveInstanceSettings({
      logoPath: null,
      // A required value cannot be blanked into an empty wordmark.
      name: null,
      footerSubtitle: null,
    });

    expect(resolved.logoPath).toBeNull();
    expect(resolved.name).toBe(instanceDefaults.name);
    expect(resolved.footerSubtitle).toBe(instanceDefaults.footerSubtitle);
  });
});

describe("instance banner", () => {
  it("announces the beta without naming the workspace", async () => {
    const { instanceDefaults } = await loadInstance();

    // The wordmark belongs to one deployment; the app is what is in beta, so
    // the compiled notice names neither an organization nor a product.
    expect(instanceDefaults.bannerEnabled).toBe(true);
    expect(instanceDefaults.bannerMessage).toBe(
      "This workspace is in beta. Found an issue or have an idea?",
    );
    expect(instanceDefaults.bannerMessage).not.toContain(instanceDefaults.name);

    // Like the build credit, this names who maintains the software rather
    // than whose workspace this is, so it holds for every deployment.
    expect(instanceDefaults.bannerLinkUrl).toBe("mailto:ryan@ryanmeetup.com");
    expect(instanceDefaults.bannerLinkLabel).toBeNull();
  });

  it("neither claims a channel nor publishes an address in the demo", async () => {
    const { demoInstanceSettings } = await loadInstance();

    expect(demoInstanceSettings.bannerEnabled).toBe(false);
    expect(demoInstanceSettings.bannerLinkUrl).toBeNull();
    expect(demoInstanceSettings.bannerLinkLabel).toBeNull();
  });

  it("lets a build write its own notice and label", async () => {
    const { instanceDefaults } = await loadInstance({
      NEXT_PUBLIC_INSTANCE_BANNER_MESSAGE: "Read-only until Monday.",
      NEXT_PUBLIC_INSTANCE_BANNER_LINK_LABEL: "See the status page",
    });

    expect(instanceDefaults.bannerMessage).toBe("Read-only until Monday.");
    expect(instanceDefaults.bannerLinkLabel).toBe("See the status page");
  });

  it("takes an https page or a mailto address", async () => {
    const page = await loadInstance({
      NEXT_PUBLIC_INSTANCE_BANNER_LINK_URL: "https://acme.example/feedback",
    });
    expect(page.instanceDefaults.bannerLinkUrl).toBe(
      "https://acme.example/feedback",
    );

    const inbox = await loadInstance({
      NEXT_PUBLIC_INSTANCE_BANNER_LINK_URL: "mailto:team@acme.example",
    });
    expect(inbox.instanceDefaults.bannerLinkUrl).toBe(
      "mailto:team@acme.example",
    );
  });

  it("rejects anything that is not a linkable destination", async () => {
    await expect(
      loadInstance({ NEXT_PUBLIC_INSTANCE_BANNER_LINK_URL: "acme.example" }),
    ).rejects.toThrow(/BANNER_LINK_URL/);
    await expect(
      loadInstance({
        NEXT_PUBLIC_INSTANCE_BANNER_LINK_URL: "javascript:alert(1)",
      }),
    ).rejects.toThrow(/BANNER_LINK_URL/);
  });

  it("lets a build past its beta ship with the banner off", async () => {
    const { instanceDefaults } = await loadInstance({
      NEXT_PUBLIC_INSTANCE_BANNER: "false",
    });

    expect(instanceDefaults.bannerEnabled).toBe(false);
  });

  it("lets a stored row turn the banner off and drop the link", async () => {
    const { resolveInstanceSettings } = await loadInstance();
    const resolved = resolveInstanceSettings({
      bannerEnabled: false,
      bannerLinkUrl: null,
    });

    expect(resolved.bannerEnabled).toBe(false);
    expect(resolved.bannerLinkUrl).toBeNull();
  });

  it("falls back to the deployment's notice when the row clears it", async () => {
    const { instanceDefaults, resolveInstanceSettings } = await loadInstance();
    const resolved = resolveInstanceSettings({ bannerMessage: null });

    expect(resolved.bannerMessage).toBe(instanceDefaults.bannerMessage);
  });
});

describe("instance footer content", () => {
  it("ships the stack links and author credit used by the compact footer", async () => {
    const { instanceDefaults } = await loadInstance();

    expect(instanceDefaults.footerSections).toHaveLength(1);
    expect(instanceDefaults.footerSections[0].title).toBe("Built with");
    expect(
      instanceDefaults.footerSections[0].links.map((link) => link.label),
    ).toEqual([
      "Vercel",
      "Next.js",
      "React",
      "Tailwind CSS",
      "Supabase",
      "Headless UI",
    ]);
    expect(instanceDefaults.creditPrefix).toBe(
      "Website designed and developed by ",
    );
    expect(instanceDefaults.creditSuffix).toBe(". All Rights Reserved.");
  });

  it("lets an instance customize its credit sentence", async () => {
    const { resolveInstanceSettings } = await loadInstance();
    const resolved = resolveInstanceSettings({
      creditPrefix: "Built by ",
      creditLabel: "Acme",
      creditSuffix: ".",
    });

    expect(resolved.creditPrefix).toBe("Built by ");
    expect(resolved.creditSuffix).toBe(".");
  });

  it("lets an instance define its own link columns rather than inherit these", async () => {
    const { resolveInstanceSettings } = await loadInstance();
    const resolved = resolveInstanceSettings({
      footerSections: [
        { title: "Company", links: [{ label: "About", url: "https://a.co/" }] },
      ],
      footerSocials: [{ platform: "linkedin", url: "https://linkedin.com/x" }],
    });

    expect(resolved.footerSections[0].title).toBe("Company");
    expect(resolved.footerSocials).toEqual([
      { platform: "linkedin", url: "https://linkedin.com/x" },
    ]);
  });

  it("treats an empty list as a deliberate removal, not an unset value", async () => {
    const { instanceDefaults, resolveInstanceSettings } = await loadInstance();

    // `null` is "no override stored", so the compiled content stands...
    expect(
      resolveInstanceSettings({ footerSections: null, footerSocials: null }),
    ).toMatchObject({
      footerSections: instanceDefaults.footerSections,
      footerSocials: instanceDefaults.footerSocials,
    });
    // ...while an empty array is the owner dropping them outright.
    expect(
      resolveInstanceSettings({ footerSections: [], footerSocials: [] }),
    ).toMatchObject({ footerSections: [], footerSocials: [] });
  });
});
