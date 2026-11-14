# AI-Slop Component Audit

Audit date: 2026-11-11. Scope: `apps/ryanmeetup`, `apps/ryancon`, `apps/store`,
`apps/tasks`, and the shared packages.

Copy is mostly clean: there is no "seamless / elevate / unlock / supercharge"
filler anywhere. The problem is visual. The marketing pages lean on the stock
generated-landing-page kit: an eyebrow over every heading, blurred background
blobs, icon-in-circle feature grids, numbered timelines, and "Ready to…?"
call-to-action cards.

## Tier 1: Clear slop

### 1. Eyebrows that repeat the heading

This shows up in two forms. `Kicker` is uppercase with wide letter-spacing. The
default `Pill` variant is also uppercase with the same 0.3em spacing, so it is
effectively a second eyebrow component.

- **Partnerships page** (`apps/ryanmeetup/app/partnerships/page.tsx`): every
  section had one ("Reach & proof", "Start the conversation", "Events &
  beyond", "Possible ingredients", "From brief to big Ryan energy"), plus a
  `Step 01` kicker beside a badge that already shows the number.
- **RyanCon**: pills that only repeat the page or section, such as "Register",
  "FAQs", "Our Mission", "Our History", "Newsletter", "Community voices", "Why
  sponsor", and "FAQ".
- **Store**: "Official Ryan provisions", "About the store", "Store support",
  and "Order confirmed".
- **Ryan Meetup**: `HeroCard` has an `eyebrow` prop and a second image eyebrow.
  `Landing` has an "Established 2023" pill and an uppercase subtitle.
- **Tasks**: a "What's new" pill above the "Changelog" heading, and a "Team
  workspace" or "Project workspace" line above the workspace title.

### 2. Blurred blobs and glows

Large, blurred, absolutely positioned circles that do nothing:

- the three contact pages (ryanmeetup, ryancon, and store);
- `HeroCard`, which also has a radial-gradient wash;
- the Tasks dashboard, which has an amber and a blue blob on a working screen;
- the changelog page and `LatestChangelogCard`;
- the dot-grid texture in the store hero.

### 3. Icon-in-circle feature grids

- the partnerships page's six "Possible ingredients" cards;
- `PartnershipPerks`, which is near-duplicated across ryanmeetup and ryancon;
- `ReachSnapshot` and `SponsorshipInfo`;
- the "helpful details" on the store contact page;
- the store home page's three-icon trust strip ("Designed by Ryan / Secure
  checkout / Tracked delivery"), which is the most generic thing in the repo.

### 4. The numbered "How it works" timeline

The partnerships page's `nextSteps` section combines numbered circles, a
connecting line, step kickers, and four generic steps.

### 5. A "Why join" bullet card

`apps/ryanmeetup/components/home/BenefitsSection.tsx` pairs "More than just a
meetup." with six generic bullets, each a dot inside a rounded box. It keeps
`benefits` and `reasons` as two arrays and then merges them into one list, so
the split means nothing.

### 6. Call-to-action cards built from a template

- a "Ready when you are" kicker over "Want to support the Ryans?" in
  `MonthlyBackerTiers`;
- "Ready to talk?" on the partnerships page;
- RyanCon's "Let's build a sponsorship plan that works for your brand."

## Tier 2: Signs across the codebase

7. **Letter-spacing sprawl.** There are 14 distinct `tracking-[…em]` values,
   from 0.05 to 0.35em. Many files hand-roll `uppercase tracking-[…]` labels
   instead of using `Kicker`, and `ReachSnapshot` and `SponsorshipInfo`
   override Kicker's own spacing.
8. **Custom shadows and corner radii.** There are 13 different one-off
   `shadow-[…]` values, mostly the same soft long-drop shadow with slightly
   different numbers. Corner radii include `rounded-[2rem]`, `[1.75rem]`, and
   `[20px]` alongside the standard `3xl`.
9. **Slop phrasing.** Examples include "Explore the channels, proof points, and
   community surfaces behind these numbers" (`ReachSnapshot`), "Why this makes
   sense for your brand", and "Built for brands that want a consistent
   presence…". UI copy also has heavy em-dash use: about 22 in ryanmeetup and
   21 in tasks components.
10. **Emoji used as icons.** The RyanCon hero shows "🏙 LOCATION TBD / 🗓 DATE
    TBD / 📍 VENUE TBD", and `RotatingGallery` uses 📍. The 🔥 on the leaderboard
    streak is fine, because it's actual personality.
11. **Faded text everywhere.** There are about 559 uses of `text-black/30` to
    `/55` in tasks and 38 in the shared packages. AGENTS.md sets secondary text
    at about `/70`.

## Not slop: leave these alone

- `Kicker` used as a real data label: StatCard labels, "Starting at $X", Usage
  stat labels, and "Typically includes" / "Best for".
- Status chips in `AccessGroupGrid` and the Usage page.
- Background blur on menus, modals, drawers, and sticky headers, which helps
  you read what's on top.
- The fade gradients in `scrollRegion` and `RotatingGallery`.
- `TestimonialCard` as a pattern, provided the quotes are real.

## Suggested rule

A kicker is allowed only when it adds information the heading doesn't, such as
a category, date, price label, or status. Then:

- fold `Pill`'s uppercase default into either a real tag or `Kicker`, so there
  is one eyebrow component rather than two;
- delete every blob `<div>`;
- pick three or four letter-spacing values and two shadows, and put them in the
  brand theme.

## Cleanup log

### 2026-11-11: eyebrows that repeat the heading

Rule applied: a label directly above a heading was removed when it only names
the page or section, or restates what the heading already says. Any top margin
on the heading that existed only to clear the label went with it.

Removed:

- **Ryan Meetup**: the partnerships section kickers ("Reach & proof", "Start
  the conversation", "Events & beyond", "Possible ingredients", "From brief to
  big Ryan energy") and the `Step 01` kickers; page pills on Gallery, Awards,
  Contribute, Donate, Contact, Membership card (`/ryd`), Charity, and Map;
  "The taps are resting" (Rytoberfest); "Three ways to back the Ryans" and
  "Ready when you are" (`MonthlyBackerTiers`); "How Sponsorship Works"; "Why
  join"; `HeroCard`'s `eyebrow` prop ("How it all started"); and the `Blurb`
  tags on Events, All Events, Upcoming Events, Flyers, Chapters, and Sponsors.
- **RyanCon**: "Community voices", "Our History", "Our Mission", "Newsletter",
  "Become a sponsor", "Why sponsor", "FAQ", "Register", "FAQs", "Need more
  help?", "About Ryan Meetup", and "RyanCon" (contact), plus the Sponsors
  `Blurb` tag.
- **Store**: "Official Ryan provisions", "About the store", the section-label
  kickers on the About page (they duplicated the "On this page" nav), "Store
  support", "Current provisions", and "Customer dispatches".
- **Tasks**: the "What's new" pill above "Changelog". The Beta pill still shows
  for prereleases.

Kept on purpose, because each carries information the heading doesn't:

- the `Blurb` tag on RSVP (the event date). The Name Change and Press tags
  were kept at first, then removed at Ryan's request;
- the store's "Order confirmed" (status) and spotlight collection label;
- the "Monthly Backer opening" and "Monthly Backer spotlight" labels (tier);
- `HeroCard`'s image caption ("First meetup");
- Landing's "Established 2023";
- the Tasks "Project / Category / Team workspace" line, which names the scope
  type. It also hosts the mobile task count, so removing it needs a layout
  change.
- data labels, and labels that are a block's only title, such as "Starting
  at", "Typically includes", "Reach Snapshot", "Helpful details", "On this
  page", "Integrations", and "Workload digest".

### 2026-11-11: follow-up decisions and the system pass

- **Blurred blobs:** kept by decision and removed from the cleanup list.
- **Store trust strip** ("Designed by Ryan / Secure checkout / Tracked
  delivery" on the store home page): deleted. The product page's similar strip
  stays, because its "Designed by Ryan" row credits the actual designer.
- **Partnerships page structure:** kept as it is.
- **"Why join" card** (on `/about`, not the homepage): replaced with a "Get
  involved" section of three linked next steps: find your chapter
  (`/chapters`), come to the next event (`/events/upcoming`), and get the
  newsletter (`/newsletter`). The six generic bullets are gone, including the
  unsupported "record-breaking scale" claim.
- **Remaining slop copy:** still open, to be done alongside the RyanCon work.
- **System tokens:** done.
  - Letter-spacing: the 14 arbitrary `tracking-[…em]` values (about 215 uses)
    now map to three brand tokens in `packages/brand/theme.css`. Values up to
    0.16em became `tracking-caps-tight` (0.12em), 0.18–0.25em became
    `tracking-caps` (0.2em), and 0.28em and up became `tracking-caps-wide`
    (0.3em). The single 0.05em use became Tailwind's `tracking-wider`.
  - Shadows: 11 of the 13 arbitrary values now map to `shadow-drop`,
    `shadow-drop-lg`, and `shadow-overlay`, or to Tailwind's `shadow-sm` and
    `shadow-lg`. The `StarRating` amber glow and the campaign-yellow tier badge
    keep their colored glows on purpose.
  - `Pill`: letter-spacing now comes from the variant alone. Previously both
    the size and the variant set it, so stylesheet order decided which won.
  - `Kicker`: uses `tracking-caps-wide`, and its one-off spacing overrides were
    removed. `EventRow`'s responsive override now uses `!`, so it wins
    reliably.
  - The AGENTS.md design rules now name these tokens, plus the kicker rule.

### 2026-11-14: radii, icon grids, and dead code

- **One-off radii:** the store home hero and the homepage sponsor spotlight
  now use Tailwind's `rounded-4xl` (2rem, unchanged) and `rounded-3xl` steps.
  The map containers, the link-preview mock, and the star rating keep their
  purpose-built radii.
- **`SponsorshipInfo`:** deleted. Nothing rendered it, and it carried the
  "Built for brands that want a consistent presence…" copy.
- **`PartnershipPerks`:** the near-identical Ryan Meetup and RyanCon copies are
  now one component in `@ryanmeetup/sponsors`. Each sponsors page passes its
  own perks, intro label, and links. The decorative icon badges are gone; a
  perk is now its label, when it has one, plus its sentence.
- **`ReachSnapshot`** (`/sponsors/partnerships`): the icon badges and the pill
  buttons inside each linked card are gone. A card is now the number, its
  sentence, and a small text label with an arrow. The "Explore the channels,
  proof points, and community surfaces behind these numbers" line is gone, and
  every card gets a visible focus ring.

Still open: the remaining template copy and the RyanCon hero's emoji
placeholders (with the RyanCon pass), and the faded secondary text in Tasks
(a design decision).
