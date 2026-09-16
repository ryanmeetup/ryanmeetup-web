import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ChangelogRelease } from "@/lib/changelog";
import { instanceBuild } from "@/lib/instance";

const changelogDirectory = path.join(process.cwd(), "changelog");
const releaseVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function compareReleaseVersions(
  left: ChangelogRelease,
  right: ChangelogRelease,
) {
  const leftParts = left.releaseVersion.split(".").map(Number);
  const rightParts = right.releaseVersion.split(".").map(Number);

  for (let index = 0; index < leftParts.length; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

function readRelease(fileName: string): ChangelogRelease {
  const source = readFileSync(path.join(changelogDirectory, fileName), "utf8");
  const { data, content } = matter(source);
  const requiredStrings = [
    "slug",
    "author",
    "date",
    "dateLabel",
    "title",
    "summary",
  ] as const;

  for (const field of requiredStrings) {
    if (typeof data[field] !== "string" || !data[field].trim()) {
      throw new Error(`Invalid ${field} in changelog/${fileName}`);
    }
  }
  // `major.minor.patch`, quoted in frontmatter so every release has one
  // canonical representation and remains valid when the beta reaches 0.10.0.
  // Major 0 is the beta series; 1.0 is reserved for the first release that
  // leaves beta, so no entry can claim to be stable by accident.
  const releaseVersion: unknown = data.version;
  if (
    typeof releaseVersion !== "string" ||
    !releaseVersionPattern.test(releaseVersion)
  ) {
    throw new Error(`Invalid version in changelog/${fileName}`);
  }
  const majorVersion = Number(releaseVersion.split(".")[0]);
  if (
    !Array.isArray(data.overview) ||
    !data.overview.every((item: unknown) => typeof item === "string")
  ) {
    throw new Error(`Invalid overview in changelog/${fileName}`);
  }

  return {
    version: `${instanceBuild.changelogVersionPrefix} v${releaseVersion}`,
    releaseVersion,
    prerelease: majorVersion < 1,
    slug: data.slug,
    author: data.author,
    date: data.date,
    dateLabel: data.dateLabel,
    title: data.title,
    summary: data.summary,
    overview: data.overview,
    content: content.trim(),
  };
}

export const changelog = readdirSync(changelogDirectory)
  .filter((fileName) => fileName.endsWith(".md"))
  .map(readRelease)
  .sort(compareReleaseVersions);

const versions = new Set<string>();
const slugs = new Set<string>();

for (const release of changelog) {
  if (versions.has(release.releaseVersion)) {
    throw new Error(`Duplicate changelog version ${release.releaseVersion}`);
  }
  if (slugs.has(release.slug)) {
    throw new Error(`Duplicate changelog slug ${release.slug}`);
  }
  versions.add(release.releaseVersion);
  slugs.add(release.slug);
}

export const latestChangelogRelease = changelog[0];

export const findChangelogRelease = (slug: string) =>
  changelog.find((release) => release.slug === slug);
