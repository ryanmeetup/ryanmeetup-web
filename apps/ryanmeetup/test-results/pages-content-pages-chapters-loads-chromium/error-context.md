# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages.spec.ts >> content pages >> /chapters loads
- Location: tests/pages.spec.ts:68:9

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: "1"
          - generic [ref=e15]: "2"
        - generic [ref=e16]:
          - text: Issue
          - generic [ref=e17]: s
      - button "Collapse issues badge" [ref=e18]
  - main [ref=e21]:
    - generic [ref=e22]:
      - heading "Something went wrong" [level=1] [ref=e23]
      - alert [ref=e24]:
        - generic [ref=e27]: "Invalid src prop (https:///group-photos/ryanroundup.png) on `next/image`, hostname \"group-photos\" is not configured under images in your `next.config.js` See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host"
      - button "Try again" [ref=e28] [cursor=pointer]
  - generic:
    - generic:
      - generic:
        - dialog "Welcome to the Ryan Meetup." [active]:
          - generic [ref=e32]:
            - heading "Welcome to the Ryan Meetup." [level=2] [ref=e35]
            - generic [ref=e39]:
              - checkbox "I certify my name is not Bryan or Brian." [ref=e40]
              - generic [ref=e41] [cursor=pointer]: I certify my name is not Bryan or Brian.
            - generic [ref=e48]:
              - button "Leave" [ref=e49] [cursor=pointer]
              - button "Continue" [disabled] [ref=e51]
  - alert [ref=e53]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const contentRoutes = [
  4  |   { path: "/" },
  5  |   { path: "/about" },
  6  |   { path: "/awards" },
  7  |   { path: "/ryd" },
  8  |   { path: "/charity" },
  9  |   { path: "/chapters" },
  10 |   { path: "/contact" },
  11 |   { path: "/contribute" },
  12 |   { path: "/donate" },
  13 |   { path: "/events" },
  14 |   { path: "/flyers" },
  15 |   { path: "/gallery" },
  16 |   { path: "/goodbye", expectText: "Goodbye, Bryan." },
  17 |   { path: "/map" },
  18 |   { path: "/press" },
  19 |   { path: "/rsvp", expectText: "Ryan Meetup returns to California" },
  20 |   { path: "/rytoberfest" },
  21 |   { path: "/sponsors" },
  22 |   { path: "/sponsors/partnerships" },
  23 | ];
  24 | 
  25 | const redirectRoutes = [
  26 |   { path: "/ryd/verify", location: "https://forms.gle/Zyv93AV4okJ6jsUo6" },
  27 |   { path: "/cards", location: "/ryd" },
  28 |   { path: "/cards/verify", location: "/ryd/verify" },
  29 |   { path: "/partnerships", location: "/sponsors/partnerships" },
  30 |   {
  31 |     path: "/chapters/pilot",
  32 |     location:
  33 |       "https://docs.google.com/document/d/1iJb9DYWPmT8mWeUMw3Da9qCpyPRtDPkfP5w6F4HapqA/edit?tab=t.0",
  34 |   },
  35 |   { path: "/discord", location: "https://discord.gg/8rPPQMtZCp" },
  36 |   {
  37 |     path: "/guidelines",
  38 |     location:
  39 |       "https://docs.google.com/document/d/1DfDD3iyrQMUHTt4EzbfPytfOOh-de1vk9pHRqqM8obs/edit?tab=t.0",
  40 |   },
  41 |   { path: "/chapter-lead", location: "https://form.typeform.com/to/TZkv7rua" },
  42 |   { path: "/join", location: "https://partiful.com/u/sJG4HpH0wS3ZA3YkzaL5" },
  43 |   { path: "/merch", location: "https://ryanmeetup.etsy.com" },
  44 |   {
  45 |     path: "/newsletter",
  46 |     location:
  47 |       "https://docs.google.com/forms/d/e/1FAIpQLSdS8O47kdOcmjXglOt_aGTs2q9qK6CrN4zGFdx62H10a-8kDg/viewform",
  48 |   },
  49 |   {
  50 |     path: "/qa",
  51 |     location:
  52 |       "https://docs.google.com/forms/d/e/1FAIpQLScP5a5ynWxQU6f1G9hvprObZQSp9QtLs_97Uf82JQJYHj4L4Q/viewform?usp=dialog",
  53 |   },
  54 |   { path: "/rcf", location: "https://us.givergy.com/rytoberfest" },
  55 |   {
  56 |     path: "/ryanday",
  57 |     location: "https://partiful.com/e/52AEebHoL4MkLoQbPKaE?c=oV8JR0Ko",
  58 |   },
  59 |   { path: "/ryanday/join", location: "https://meet.google.com/smt-ubsk-aeo" },
  60 |   {
  61 |     path: "/whatsapp",
  62 |     location: "https://chat.whatsapp.com/LeI37a2AlMk0OmMfhXPNvq",
  63 |   },
  64 | ];
  65 | 
  66 | test.describe("content pages", () => {
  67 |   for (const route of contentRoutes) {
  68 |     test(`${route.path} loads`, async ({ page }) => {
  69 |       const response = await page.goto(route.path);
> 70 |       expect(response?.ok()).toBeTruthy();
     |                              ^ Error: expect(received).toBeTruthy()
  71 | 
  72 |       if (route.path !== "/ryd")
  73 |         await expect(page).toHaveTitle(/Ryan Meetup/);
  74 | 
  75 |       if (route.expectText) {
  76 |         await expect(page.getByText(route.expectText)).toBeVisible();
  77 |         return;
  78 |       }
  79 | 
  80 |       await expect(page.getByRole("main")).toBeVisible();
  81 |     });
  82 |   }
  83 | });
  84 | 
  85 | test.describe("redirect pages", () => {
  86 |   for (const route of redirectRoutes) {
  87 |     test(`${route.path} redirects`, async ({ request }) => {
  88 |       const response = await request.get(route.path, { maxRedirects: 0 });
  89 |       expect([301, 302, 307, 308]).toContain(response.status());
  90 |       expect(response.headers().location).toBe(route.location);
  91 |     });
  92 |   }
  93 | });
  94 | 
```