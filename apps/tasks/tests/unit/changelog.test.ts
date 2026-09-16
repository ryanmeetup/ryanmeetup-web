import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  changelog,
  findChangelogRelease,
  latestChangelogRelease,
} from "@/lib/server/changelog";
import { changelogReleasePath } from "@/lib/changelog";

describe("changelog", () => {
  it("keeps the approved versions in newest-first order", () => {
    expect(changelog.map((release) => release.version)).toEqual([
      "TASK v0.9.0",
      "TASK v0.8.1",
      "TASK v0.8.0",
      "TASK v0.7.0",
      "TASK v0.6.0",
      "TASK v0.5.0",
      "TASK v0.4.0",
      "TASK v0.3.0",
      "TASK v0.2.0",
      "TASK v0.1.0",
    ]);
    expect(latestChangelogRelease.version).toBe("TASK v0.9.0");
    // 1.0.0 is the first release out of beta, so nothing published yet claims it.
    expect(changelog.every((release) => release.prerelease)).toBe(true);
    expect(changelog.every((release) => release.author === "Ryan Le")).toBe(
      true,
    );
    expect(changelog.every((release) => release.content.length > 0)).toBe(true);
  });

  it("builds and resolves stable release paths", () => {
    for (const release of changelog) {
      expect(changelogReleasePath(release)).toBe(`/changelog/${release.slug}`);
      expect(findChangelogRelease(release.slug)).toBe(release);
    }
    expect(findChangelogRelease("not-a-release")).toBeUndefined();
  });

  it("keeps the app package on the latest public release", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { version: string };

    expect(packageJson.version).toBe(latestChangelogRelease.releaseVersion);
  });
});
