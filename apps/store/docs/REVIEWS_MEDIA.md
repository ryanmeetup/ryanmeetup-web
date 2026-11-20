# Custom review photo processing

Updated November 20, 2026. Server processing and private staging primitives are
implemented and tested. Migration `20261120220000` adds the private RMT schema/
bucket; see [the rebuild inventory](REVIEWS_REBUILD.md) for its rollout status.
Browser photo collection is still unavailable: there is no upload endpoint,
buyer attachment UI, review association or staff media moderation/publication
path. Custom public SQL still returns `photos: []`.

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
server service. A future HTTP handler must authenticate/recheck the buyer and
product and process their bytes before invoking it; browser-supplied subjects,
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
digest/size/dimension conflicts. Expired/discarded keys stay closed. Other
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

The next boundary is the authenticated upload route and atomic association
with the pending review revision. Preserve the existing publication rules:

- Authenticate the buyer and scope every media operation to the intended shop
  and buyer. Establish review/draft ownership before issuing expiring upload
  authority; a submitted object name or public URL is not proof of ownership.
- Keep future media migrations in the canonical RMT-only history, separate
  from Tasks attachments and excluded from PRD. Staging introduces no second
  Store migration history.
- Bound request bytes before buffering them. Use the processor on server-owned
  staged bytes, with bounded work/concurrency and abuse controls. Keep failed
  or unprocessed objects private.
- Attach only processed, owned media to the intended pending revision. Enforce
  the shared `REVIEW_PHOTOS_MAX` value of five at the server/data boundary,
  including retries, parallel submissions and edits.
- Build buyer selection, previews and removal using the existing shared
  `FileDropField`. Align visible format/size guidance with the actual processor
  and the eventual upload limits.
- Add staff media decisions and approved-only publication. Pending edit photos
  must not replace or leak alongside the currently approved revision. Hiding
  or withdrawing a review must remove its public media access as well.
- Add the custom image-host configuration and public projection only after
  approved media has a publication/access model. A permanent public object URL
  can outlive a hidden review; hiding just the card is insufficient.
- Implement failed/abandoned upload cleanup and removal, retention and export
  behavior, then prove recovery of objects and their database associations.

This checkpoint changes no authentication, purchase-verification or text-review
submission contract. The staging table/RPCs and private bucket are independent
of the existing review/revision tables; no public projection was changed.

## Local evidence

From `apps/store`, with no live service or browser server:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-photo-processing.spec.ts tests/review-photo-staging.spec.ts --workers=1 --output=test-results-public-reviews/photo-unit
```

All ten processor scenarios passed using generated binary fixtures. Coverage
includes each supported format, exact/over byte limits, disguised content,
truncated files, aspect ratio/no enlargement, a tiny PNG advertising over forty
million pixels, real EXIF GPS/orientation data, XMP/ICC removal, pixel-level
rotation checks, transparency, animated WebP/APNG and caller buffer mutation.

The earlier combined photo/public-view run passed 39 tests. The current
processor/staging run passed 20, including lost upload/finalization/discard
responses, digest mismatches, quota/closed outcomes, owner checks, removal
failures and malformed projections. Changed-file ESLint, `git diff --check`
and the isolated custom-mode Store production build passed. CI has a dedicated
photo step and keeps artifacts under `test-results-public-reviews/photo-unit`.

Both migration profiles reset from empty in separately named local stacks:
RMT passed 330 database assertions (46 specific staging assertions), two real
encrypted-storage integration checks and allocation/auth races. PRD passed 65
assertions and verifies the draft table/bucket are absent. The 16 scoped
planner/catch-up tests passed. The profile runner never resets the existing
app stack and its server-free storage checks no longer start a Store dev server.
These checks do not prove a hosted buyer upload or media moderation lifecycle.
