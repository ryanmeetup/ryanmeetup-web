# Page metadata and structured data

How the store tells search engines and link previews what each page is. Read
this before adding a route or changing what a page publishes in its `<head>`.

## Page metadata

- `lib/metadata.ts` configures the shared `@ryanmeetup/metadata` builder once.
  `SITE_URL` is fixed to `https://store.ryanmeetup.com`, so previews and local
  runs still link to the real store.
- Every indexable page exports `metadata` or `generateMetadata` built with
  `buildPageMetadata`, which sets the title, description, canonical, Open Graph,
  and Twitter tags together.
- The root layout holds **site-wide defaults only**: `metadataBase`, the title
  template, the default description and social image. Next.js replaces nested
  fields rather than merging them, so a canonical or `og:url` in the layout
  would be inherited by every page that sets none. The home page sets its own
  in `app/page.tsx`, and the 404 page deliberately has neither.
- Titles stay short ("Name Tag Shirt"); the template adds "| Ryan Meetup Store"
  in the browser tab only. Social cards show the bare title.
- Descriptions go through `toMetaDescription`, which cuts at a word near 160
  characters. Products use their intro (`getProductMetaDescription`), policies
  their first sentences after the "Last updated" line, and catalog pages the
  collection description.
- Private or transactional pages (cart, My Reviews, review sign-in, the
  product-by-ID redirect) pass `robots: { index: false }`. Pages that keep
  state in the query string (`?design=`, `?color=`, `?from=`, sort, review
  filters) canonicalize to the bare path.

## Structured data

JSON-LD is rendered with `components/json-ld.tsx`, which escapes `<` so the
payload cannot close its script early.

| Page | Schema | Builder |
| --- | --- | --- |
| Home | `OnlineStore` (parent organization Ryan Meetup, social profiles, no-returns policy) and `WebSite` | `buildStoreSchema` |
| Product, collection, department, garment | `BreadcrumbList` by canonical path, ignoring the visible `from` trail | `buildBreadcrumbSchema` |
| Product | `ProductGroup` with one `Product` + `Offer` per Shopify variant; a single-variant product is a plain `Product` | `buildProductSchema` |

The store's `MerchantReturnPolicy` is `MerchantReturnNotPermitted`, since all
sales are final, and its countries come live from Shopify Markets
(`getShippingCountries`), so adding or removing a market needs no code change.
If Shopify can't be reached, the policy is left out rather than guessed.

Product schema rules:

- Size and color options map to schema.org `size`/`color` and `variesBy`; any
  other option becomes an `additionalProperty`.
- Each offer carries its own price, stock, `NewCondition`, and the store as
  seller, inlined by name because only the home page has the full store node.
- `aggregateRating` appears only when reviews loaded and at least one exists,
  with the half-star scale (`worstRating` 0.5, `bestRating` 5).
- A grouped listing describes the design rendered on the server; its `url` is
  the canonical listing, and its offers keep the selected design or color.

Validate changes with Google's [Rich Results Test](https://search.google.com/test/rich-results)
against a deployed URL.

## Sitemap and robots

`app/sitemap.ts` lists only canonical URLs: grouped products appear once,
under the listing handle. Product entries carry `lastModified` from Shopify's
`updatedAt`, using the newest member for a grouped listing. `app/robots.ts`
allows everything except `/api/`.

## Shopify content cleanup

The Storefront client (`storefrontRequest` in `lib/shopify.ts`) cleans two
kinds of editor residue before any page sees them:

- Printful's placeholder alt text "Product mockup" becomes `null`, so images
  and social cards fall back to the product title. Write real alt text in
  Shopify to do better than the title.
- `<meta>` tags pasted from Google Docs, and the empty paragraphs they leave,
  are removed from product descriptions and policy bodies.
