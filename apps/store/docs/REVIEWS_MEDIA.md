# Custom review photo processing

Updated November 20, 2026. Server processing, private staging, a gated
same-origin upload/discard API and atomic pending-revision associations are
implemented. RMT-only migrations `20261120220000` and `20261120230000` own the
schema; see [the rebuild inventory](REVIEWS_REBUILD.md) for rollout evidence.
`STORE_REVIEW_PHOTOS_ENABLED` is **false by default** and was not enabled by
this work. Buyer attachment UI and staff media moderation/publication remain
unbuilt. Custom public SQL still returns `photos: []`.

## Implemented processor

[`prepareReviewPhoto`](../lib/review-photo-processing.ts) accepts a byte array
and an optional declared MIME type. It has no filename, filesystem-path,
remote-URL, buyer, review or storage input. It returns either a fixed failure
reason or an owned WebP buffer with its MIME type and decoded output dimensions.
It does not write original files, upload anything or authorize publication.

These are the initial implementation limits, not a claim that a live upload
policy has been approved or enabled:

| Boundary | Current implementation |
| --- | --- |
| Input formats | JPEG, PNG and WebP identified from bytes and checked against the decoder's format. Other formats, including GIF, SVG, HEIC, AVIF and TIFF, are refused. |
| Declared MIME | May be absent; otherwise must match the actual supported format. Case, whitespace and MIME parameters are normalized. File extensions do not establish type. |
| Input bytes | At most 10 MiB, checked before making the processor's owned copy or invoking the decoder. |
| Input pixels/channels | At most 40 million pixels and four channels through the native decoder's limits. Corrupt, truncated or over-limit input returns `invalid_image`. |
| Animation | Animated WebP and APNG are refused. Container animation chunks/flags are checked in addition to decoder page metadata. |
| Output | Re-encoded single-image WebP, sRGB, quality 85, at most 2048 pixels on either edge, preserving aspect ratio without enlargement. Alpha is retained. |
| Output bytes | A result larger than 4 MiB is not returned as successful. This is an output validation gate after encoding. |
| Processing time | A ten-second native processing timeout. Queue waiting is excluded; this is not an end-to-end request deadline. |
| Metadata | Orientation is applied to pixels. EXIF/GPS, XMP and ICC metadata are not copied to the output. |

The processor uses the already-resolved Sharp `0.35.5`, now declared directly
by the Store. See Sharp's [input limits](https://sharp.pixelplumbing.com/api-constructor/),
[metadata reader](https://sharp.pixelplumbing.com/api-input/) and
[output/timeout behavior](https://sharp.pixelplumbing.com/api-output/) for the
library boundaries. Header checks and the output gate do not replace bounded
request reading, concurrency control or a worker/runtime resource budget.

Failures expose only `empty`, `too_large`, `unsupported_type`, `type_mismatch`,
`animated`, `invalid_image` or `output_too_large`. Decoder messages, original
metadata and exceptions are not returned or logged by this module. The source
buffer is copied before asynchronous work so later caller mutation cannot
change the file being checked.

## Implemented private staging

[`createReviewPhotoStaging`](../lib/review-photo-staging.ts) is a private Store
server service. The HTTP handler authenticates/rechecks the buyer and
product and processes their bytes before invoking it; browser-supplied subjects,
shop IDs, paths and URLs are not authority. Its production factory uses the
existing RMT-only database guard. No auth/session/purchase code was changed.

`store_review_photo_drafts` holds a generated UUID, configured shop, buyer
subject, product, scoped request key, normalized-byte SHA-256/size/dimensions,
state and expiry. The private `store-review-photos` bucket accepts only WebP up
to 4 MiB. Anonymous/Tasks-member access is excluded by a restrictive object
policy as well as the private bucket; only the service role accesses it.

The allocation RPC serializes a buyer/product quota: at most five unexpired
`uploading`/`ready` slots, initially expiring after one hour. These are staging
implementation bounds. Identical scoped retries reuse their slot; a changed
digest/size/dimension conflicts. Expired/discarded/attached keys stay closed. Other
buyers, products and shops cannot read, finish or discard a known ID.

Only normalized bytes are uploaded to `shop-id/generated-uuid.webp`, without
upsert. A lost/rejected upload response can recover only by downloading that
private object and checking its exact size and digest. Finalization then
rechecks ownership, digest, state and expiry. Ready references contain only
ID, dimensions and expiry, never a storage path, digest, subject or signed URL.

An uncertain finalization leaves the private object and slot for an explicit
same-key retry. Confirmed owner-scoped discard precedes object removal; lost
discard responses/failed removal can be retried idempotently. There is no
automatic destructive compensation and no expiry sweep yet. Expiry stops
reads/finalization and quota consumption; it does not delete stored objects.

## Implemented HTTP boundary

[`POST /api/reviews/photos`](../app/api/reviews/photos/route.ts) requires custom
mode, `STORE_REVIEW_PHOTOS_ENABLED=true`, configured RMT storage, an active
Shopify buyer session and the storefront's exact origin. It accepts a single
raw JPEG/PNG/WebP body with numeric `productId` and UUID `requestKey` query
parameters. Unknown/duplicate parameters are refused; no buyer, shop, path or
URL can come from the browser. The server repeats the existing purchase lookup
and checks the catalog for products without an eligible line. Lookup failures
remain unavailable. Existing verified/unverified review submission rules are
unchanged.

The raw HTTP cap is **4 MiB**, checked against actual streamed bytes and any
Content-Length. It deliberately fits below [Vercel's 4.5 MB request limit](https://vercel.com/docs/functions/limitations#request-body-size);
the reusable processor's 10 MiB cap is not the upload cap. Empty/corrupt files
are refused. Body reading has a ten-second deadline; native processing retains
its own ten-second timeout. The Node route declares a thirty-second hosting
budget. Two body/decoder pipelines may run per process, with no decoder queue.

A transactionally enforced shop/buyer budget allows thirty attempts per ten
minutes across processes/products. Attempts are counted before Shopify and
image work, including failures/retries. Denial returns 429 and Retry-After;
a busy process returns 503 with retry guidance. These are implementation caps,
not a claim of a complete hosted abuse/monitoring setup. The budget table has
private RLS/service-role-only grants. No IPs are recorded.

Session identity is rechecked before staging and before returning its reference.
An account change returns no reference; an uncertain private object is left for
cleanup, never destructively removed. All handler results use no-store and
no-referrer headers and fixed safe error copy.

`DELETE /api/reviews/photos?productId=...&photoId=...` uses the same feature,
origin and session boundary. It discards only a matching unattached draft,
confirms the database transition, then removes the derived private object.
Attached/historical media cannot be deleted through the draft API. There is no
public/private photo-download route or signed browser upload capability.

## Implemented pending-revision associations

Migration `20261120230000` adds private `store_review_revision_photos` with
ordered positions 1–5 and an independent pending/approved/rejected media state.
Submit/edit commands can carry a strictly validated, unique `photoIds` array.
Missing IDs preserve the old text submission path; a text-only edit retains
its current photo selection. An explicit empty edit array removes photos from
the new pending revision. Nonempty arrays require the photo feature flag.

New atomic RPC wrappers call the existing canonical submit/version-checked edit
functions. They then validate every photo's shop, buyer, product, ready state,
expiry and private stored-object existence under locks. A draft is claimed for
one review and moves to `attached`; only that same review may retain/reuse it
later. Attached rows no longer consume draft slots, return through draft reads,
revive on retries or permit discard. The count bound includes retained/new IDs.

Invalid media rolls back **all** text, revision, version and audit changes and
returns `invalid_photos` with no review ID. Normal version/idempotency/ownership
outcomes are preserved. Existing approved revisions keep their photo selection
while pending edits wait. Each new revision's media decision starts pending;
text approval does not approve photos. No media enters public projections.

## Remaining work

- Build buyer selection, previews, retry/removal and edit behavior using shared
  `FileDropField`, with the actual 4 MiB HTTP guidance. Add a private preview
  access model and extend private buyer reads with the selected photo refs.
- Add staff media decisions and approved-only publication. Hiding/withdrawing
  must revoke public media access, not merely hide a card with a permanent URL.
- Add custom image-host configuration and public projection after that access
  model exists. Keep pending edits separate from the approved media set.
- Implement failed/abandoned upload cleanup, budget-row cleanup, removal,
  retention/export behavior and recovery of objects plus associations. Expiry
  stops draft use but does not delete objects; historical attachments stay
  protected until a deliberate lifecycle operation removes them.
- Rehearse the complete hosted buyer-to-media-moderation lifecycle before
  enabling collection. This checkpoint changed no Shopify auth/purchase logic,
  provider selection, production feature flag or existing buyer content.

## Local evidence

From `apps/store`, with no live service or browser server:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-photo-processing.spec.ts tests/review-photo-staging.spec.ts tests/review-photo-actions.spec.ts --workers=1 --output=test-results-public-reviews/photo-unit
```

All ten processor scenarios passed using generated binary fixtures. Coverage
includes each supported format, exact/over byte limits, disguised content,
truncated files, aspect ratio/no enlargement, a tiny PNG advertising over forty
million pixels, real EXIF GPS/orientation data, XMP/ICC removal, pixel-level
rotation checks, transparency, animated WebP/APNG and caller buffer mutation.

The earlier combined photo/public-view run passed 39 tests and the staging
checkpoint passed 20 processor/staging tests. Current collection evidence is
recorded in [the rebuild inventory](REVIEWS_REBUILD.md): native image checks,
actual Supabase-client transport fakes, streamed HTTP/body/session/concurrency
checks, atomic SQL rollback and independent media decisions. CI includes the
photo handler in its dedicated step and keeps isolated artifacts.

Both migration profiles are tested from empty in separately named local
stacks. RMT covers the private schema and claim/budget races; PRD verifies all
Store objects are excluded. The runner never resets the existing app stack.
These checks do not prove a hosted buyer upload or media moderation lifecycle.
