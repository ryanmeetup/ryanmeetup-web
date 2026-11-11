# Ryan Meetup Site Instructions

These instructions supplement the repository-root `AGENTS.md` for work in
`apps/ryanmeetup`. The root instructions remain authoritative for shared
packages, design language, accessibility, responsive behavior, and validation.

## Product scope

This app is the public RyanMeetup.com site. It contains the community's event,
chapter, map, gallery, press, sponsor, donation, and informational pages. Keep
route composition, campaign copy, navigation, Contentful adapters, and
Ryan Meetup-specific behavior in this app. Continue moving genuinely reusable
presentation and behavior into the existing workspace packages described by
the root instructions.

Treat current source code and the shared brand package as the design source of
truth. `DESIGN_SYSTEM.md` is an older transfer guide and may reference removed
app-local components, Tailwind configuration, fonts, or plugins; do not restore
those patterns without confirming them against the current implementation.

## App structure and ownership

- Route pages and handlers live in `app/` and use the Next.js App Router.
- Reusable app-specific sections live under `components/<feature>`.
- The site shell is `components/navigation/Layout.tsx`; content pages normally
  render inside `Layout` so the banner, header, campaign CTA, spacing, theme,
  and footer stay consistent.
- Contentful access belongs in `actions/fetchContent.ts`. Contentful field and
  app-domain types belong in `lib/types.ts` unless a type is reusable outside
  this app.
- App-specific transforms belong in `utils/`. Use `@ryanmeetup/utils` for an
  existing framework-agnostic helper instead of adding a local duplicate.
- Shared UI, hooks, contact behavior, and sponsor behavior come from
  `@ryanmeetup/ui`, `@ryanmeetup/hooks`, `@ryanmeetup/contact`, and
  `@ryanmeetup/sponsors`. Import them directly rather than adding pass-through
  app-local modules. Preserve an existing compatibility re-export only until
  its consumers can be migrated safely.
- Use the `@/` alias only for code owned by this app.

Before creating UI, search both this app and `packages/ui/src`. Existing shared
primitives used throughout the site include `Button`, `Card`, `Heading`,
`Text`, `Kicker`, `Pill`, `Blurb`, `Divider`, `EmptyState`, fields, filter
controls, disclosures, navigation, and footer compositions.

## Pages, routing, and metadata

- Prefer Server Components for pages and data loading. Isolate hooks, browser
  APIs, Mapbox, theme state, and interactive filtering in focused client
  components.
- Await `params` and `searchParams` before reading them. Keep their types
  compatible with the promise-based dynamic APIs used by the installed Next.js
  version.
- Wrap ordinary content pages in the shared app-local `Layout`. Preserve the
  established full-screen or redirect behavior when a route intentionally does
  not use the shell.
- Use `next/link` for internal navigation. Keep simple outbound convenience
  routes as explicit redirects when that route is part of the public URL
  surface, and update redirect coverage when changing one.
- Every public content page must export metadata through
  `buildPageMetadata` from `@/utils/metadata`; dynamic pages must use
  `generateMetadata` with the same helper. Supply an accurate title,
  description, canonical URL, and social image dimensions. Prefer `SITE_URL`
  over repeating the production origin in new code.
- Preserve meaningful structured data when changing event or other SEO-heavy
  pages. Serialize trusted application data with `JSON.stringify`; do not build
  JSON-LD through string concatenation.
- Update `app/sitemap.ts` when adding, removing, or materially renaming an
  indexable route.

## Contentful and external data

- Keep Contentful credentials and SDK use server-side. Never expose
  `CONTENTFUL_SPACE_ID` or `CONTENTFUL_ACCESS_TOKEN` through public environment
  variables or client components.
- Add Contentful reads to `actions/fetchContent.ts` and cache them consistently
  with `unstable_cache`, a unique stable cache key, and the established
  revalidation interval unless the feature explicitly requires different
  freshness.
- Preserve pagination for content types that may exceed Contentful's per-query
  limit; the locations fetch is the reference implementation.
- Do not invent CMS fields or rely on an unchecked shape. Extend the app's
  Contentful/domain types and narrow optional data at the boundary. Avoid new
  `@ts-ignore` comments; if the SDK query typing is insufficient, document and
  narrowly type the mismatch.
- Use `convertImageUrl` for Contentful assets and provide a deliberate fallback
  when the image is optional. Contentful image dimensions should come from the
  asset when available.
- Do not silently replace a failed production CMS request with fixture or fake
  content. Surface a suitable empty, not-found, or error state.

## Content and campaign facts

- Contentful is authoritative for CMS-managed events, chapters, sponsors,
  media, press, awards, donations, and flyers. Do not hard-code a CMS-managed
  fact merely to make a page render.
- Dates, locations, RSVP destinations, banner text, and floating campaign CTAs
  are time-sensitive. Confirm them from current repository/CMS context before
  changing them, and update all coupled placements and tests together.
- Keep the Ryan voice warm, concise, and lightly playful. Preserve the site's
  recurring identity, including “No Bryans allowed,” without letting the joke
  obscure instructions, accessibility labels, errors, or calls to action.
- Do not invent attendance numbers, record claims, partner commitments,
  chapter status, donation totals, or event details.

## Search, filters, and client state

- Use the shared `useSearchFilter` and `useQueryParamState` hooks for searchable
  or URL-backed collections. Follow the repository-wide pending-state and
  accessibility requirements for search.
- Keep filtering and sorting transforms deterministic and testable in `utils/`
  when they do not require React.
- Preserve human-readable query parameters and shareable filtered views.
- Mapbox rendering must remain client-side. Keep the public map token limited
  to `NEXT_PUBLIC_MAPBOX_TOKEN`, and retain an accessible non-map explanation
  or test-mode representation where applicable.

## Testing and fixtures

- Playwright runs with both `E2E_TESTS=true` on the server and
  `NEXT_PUBLIC_E2E_TESTS=true` in the browser. CMS-dependent routes must use the
  deterministic fixtures in `lib/test-fixtures` only when the corresponding
  test flag is enabled.
- Add or update fixtures when changing CMS-dependent rendering. Fixtures must
  mirror the relevant production shape closely enough to exercise the real UI.
- Update `tests/pages.spec.ts` when adding or removing public content routes or
  redirect routes. Add focused Playwright coverage for changed navigation,
  filtering, forms, theme behavior, maps, or other browser interactions.
- Place framework-agnostic utility tests under `tests/utils`.

## Validation

For changes in this app, run the narrowest relevant checks and expand them when
shared packages, routing, configuration, or production rendering change:

```sh
npm run lint --workspace=@ryanmeetup/ryanmeetup
npm run test:e2e --workspace=@ryanmeetup/ryanmeetup
npm run build:ryanmeetup
git diff --check
```

For visual changes, inspect light and dark themes at mobile width and at the
1024, 1280, and 1536 pixel boundaries. Verify the site shell, campaign CTA,
navigation, CMS empty states, and any route-specific layout touched by the
change.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
