export type ChangelogRelease = {
  /** Display version, e.g. "RMT v0.8.1". Built from the instance prefix. */
  version: `${string} v${string}`;
  /** Version as written in the markdown frontmatter, e.g. "0.5". */
  releaseVersion: string;
  /**
   * Whether this release is still pre-1.0. Every surface that marks the app as
   * beta reads this rather than hardcoding the word, so the first 1.x release
   * retires the beta treatment by being published.
   */
  prerelease: boolean;
  slug: string;
  author: string;
  date: string;
  dateLabel: string;
  title: string;
  summary: string;
  overview: string[];
  content: string;
};

export const changelogReleasePath = (release: ChangelogRelease) =>
  `/changelog/${release.slug}`;
