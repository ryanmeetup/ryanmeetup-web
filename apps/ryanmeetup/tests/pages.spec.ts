import { test, expect } from "@playwright/test";

const contentRoutes = [
  { path: "/" },
  { path: "/about" },
  { path: "/awards" },
  { path: "/cards" },
  { path: "/charity" },
  { path: "/chapters" },
  { path: "/contact" },
  { path: "/contribute" },
  { path: "/donate" },
  { path: "/events" },
  { path: "/flyers" },
  { path: "/gallery" },
  { path: "/goodbye", expectText: "Goodbye, Bryan." },
  { path: "/map" },
  { path: "/press" },
  { path: "/rsvp", expectText: "Ryan Meetup returns to California" },
  { path: "/sponsors" },
  { path: "/sponsors/partnerships" },
];

const redirectRoutes = [
  { path: "/partnerships", location: "/sponsors/partnerships" },
  {
    path: "/chapters/pilot",
    location:
      "https://docs.google.com/document/d/1iJb9DYWPmT8mWeUMw3Da9qCpyPRtDPkfP5w6F4HapqA/edit?tab=t.0",
  },
  { path: "/discord", location: "https://discord.gg/8rPPQMtZCp" },
  {
    path: "/guidelines",
    location:
      "https://docs.google.com/document/d/1DfDD3iyrQMUHTt4EzbfPytfOOh-de1vk9pHRqqM8obs/edit?tab=t.0",
  },
  { path: "/chapter-lead", location: "https://form.typeform.com/to/TZkv7rua" },
  { path: "/join", location: "https://partiful.com/u/sJG4HpH0wS3ZA3YkzaL5" },
  { path: "/merch", location: "https://ryanmeetup.etsy.com" },
  {
    path: "/newsletter",
    location:
      "https://docs.google.com/forms/d/e/1FAIpQLSdS8O47kdOcmjXglOt_aGTs2q9qK6CrN4zGFdx62H10a-8kDg/viewform",
  },
  {
    path: "/qa",
    location:
      "https://docs.google.com/forms/d/e/1FAIpQLScP5a5ynWxQU6f1G9hvprObZQSp9QtLs_97Uf82JQJYHj4L4Q/viewform?usp=dialog",
  },
  { path: "/rcf", location: "https://us.givergy.com/rytoberfest" },
  {
    path: "/whatsapp",
    location: "https://chat.whatsapp.com/LeI37a2AlMk0OmMfhXPNvq",
  },
];

test.describe("content pages", () => {
  for (const route of contentRoutes) {
    test(`${route.path} loads`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.ok()).toBeTruthy();

      if (route.path !== "/cards")
        await expect(page).toHaveTitle(/Ryan Meetup/);

      if (route.expectText) {
        await expect(page.getByText(route.expectText)).toBeVisible();
        return;
      }

      await expect(page.getByRole("main")).toBeVisible();
    });
  }
});

test.describe("redirect pages", () => {
  for (const route of redirectRoutes) {
    test(`${route.path} redirects`, async ({ request }) => {
      const response = await request.get(route.path, { maxRedirects: 0 });
      expect([301, 302, 307, 308]).toContain(response.status());
      expect(response.headers().location).toBe(route.location);
    });
  }
});
