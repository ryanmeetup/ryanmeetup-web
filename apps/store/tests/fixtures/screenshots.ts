import { test } from "@playwright/test";

/**
 * Where a test saves a screenshot for review: its own Playwright output folder
 * (test-results/), which exists on every OS. A fixed /private/tmp path only
 * exists on macOS and fails on CI runners.
 */
export const screenshotPath = (name: string) => test.info().outputPath(name);
