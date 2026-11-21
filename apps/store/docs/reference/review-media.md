# Custom review media

Reviewed November 20, 2026 against the Store handlers/UI and canonical SQL.
Server processing, private staging, upload/discard, atomic revision associations,
private selection/preview reads and buyer composer/edit controls are implemented.
Owner preview and independent photo decisions are implemented in Tasks, with
approved-only, revision-bound public delivery through the Store. The private
Storage bucket remains private. Photo attachments are enabled by default for
signed-in buyers with configured RMT storage. Set `STORE_REVIEW_PHOTOS_ENABLED=false`
to pause collection; invalid nonempty values also disable it. Buyer photo routes
honor this setting; staff moderation and approved public images remain available during a
collection pause. See [the database guide](review-database.md) for rollout status.

## Implemented processor

[`prepareReviewPhoto`](../../lib/review-photo-processing.ts) accepts a byte array
and an optional declared MIME type. It has no filename, filesystem-path,
remote-URL, buyer, review or storage input. It returns either a fixed failure
reason or an owned WebP buffer with its MIME type and decoded output dimensions.
It does not write original files, upload anything or authorize publication.

These are source limits, not evidence that deployed collection is enabled:

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

The Store declares Sharp directly; use its package/lockfile version when
changing processor behavior. See Sharp's [input limits](https://sharp.pixelplumbing.com/api-constructor/),
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

[`createReviewPhotoStaging`](../../lib/review-photo-staging.ts) is a private Store
server service. The HTTP handler authenticates/rechecks the buyer and
product and processes their bytes before invoking it; browser-supplied subjects,
shop IDs, paths and URLs are not authority. Its production factory uses the
existing RMT-only database guard. Existing buyer authentication and purchase/unverified-feedback rules apply.

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

[`POST /api/reviews/photos`](../../app/api/reviews/photos/route.ts) requires
photo collection enabled (the default), configured RMT storage, an active
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
Attached/historical media cannot be deleted through the draft API. Private
previews use authenticated Store GETs below. Public delivery uses a separate
approved-only route; neither path issues signed Storage capabilities.

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
approving the revision approves its still-pending photos, and photos rejected
first stay rejected (migration `20261121130000`). Only approved photos on the
current approved revision enter public projections.

## Implemented private buyer reads

Migration `20261121000000` adds two service-only, invoker RPCs; no new tables,
public grants, publication behavior or Shopify auth changes. The Store's
[`private reader`](../../lib/review-photo-reader.ts) pins the shop, validates strict
responses and derives the fixed private object path itself.

- `GET /api/reviews/photos/selection?reviewId=...` returns the owned review's
  product ID, exact six-digit `updatedAt` and up to five ordered `{id,width,height}`
  references. This is a separate private read, leaving existing My reviews
  page/row contracts unchanged. The implemented editor compares that version with
  its text snapshot before combining selections and edits.
- `GET /api/reviews/photos?productId=...&photoId=...` returns only verified WebP
  bytes through the Store. Ready drafts must remain owned/unexpired. Attached
  photos must belong to the buyer's **current** revision selection: pending,
  else approved, else latest buyer attempt by audit order, matching buyer text
  reads. Removed/historical selections are unavailable. Owners may privately
  inspect their current hidden/withdrawn reviews; this grants no public access.

Both routes require the photo flag, active buyer authentication
and a same-origin read. Cross-site and sibling-site browser reads are refused;
unknown/duplicate query keys and browser-supplied subjects/paths/URLs are
refused. Unknown and foreign records share the same private unavailable result.
Session identity is checked again after reading, before references/bytes return.

The server checks photo authorization before downloading and again afterward,
so expiry, discard or selection changes during the download revoke the response.
It streams through the authenticated Storage client, aborts after ten seconds,
limits actual bytes to the expected size (at most 4 MiB), and verifies length
and SHA-256 before returning anything. Four preview pipelines may run per
process, without a queue. Busy responses carry retry guidance. Errors never
return raw Storage details, paths, digests, buyer IDs or signed URLs.

Image responses use `no-store`, `no-referrer`, `Vary: Cookie`, `nosniff` and
`Cross-Origin-Resource-Policy: same-origin`. They carry no ETag/redirect or
public storage capability. The buyer UI fetches this authenticated path and
creates a private browser blob URL only after validating the viewer and content
type/size. Its `next/image` uses `unoptimized`; the server image optimizer never
receives buyer credentials or caches these previews. Closing, hiding the page,
account changes and unmount revoke loaded URLs and cancel pending work.

## Implemented buyer photo controls

Product composers, Ready to review suggestions and My reviews edits now reuse
shared `FileDropField`. The field appears only when the server enables photos;
no new public environment variable or production flag was set. It accepts up
to five retained/new photos together, with visible still JPEG/PNG/WebP and
4 MiB guidance, private previews, per-file retry and remove actions.

One upload runs at a time. A failed upload is retried explicitly with the same
request key and bytes; a preview retry reuses the ready reference. Known expired
uploads require a fresh key on explicit retry. Pending/failed photos block save
with visible status and recovery actions. Removing a new ready draft confirms
its scoped discard; removing a retained attachment only changes the next
revision's selection, preserving approved/history objects.

Editing loads the saved selection and requires its exact version to match the
text editor. It never combines old text with a newer selection or silently
falls back to an empty list after a read failure. Explicit empty selections
remove all photos from the new pending revision. A successful save clears the
form's local photo state; uncertain saves preserve the existing review-action
reload/reconciliation behavior.

`GET /api/reviews/photos/context` privately rechecks the session and returns a
noncredential viewer equality marker. Enabled forms receive that same derived
marker from the server; they validate it on open, before submit, on focus and
when returning to a visible page. Photo requests and photo-enabled review writes
send `X-Review-Viewer` outside the JSON body. The server refuses a supplied
marker that differs from the authenticated session before lookup/upload/write;
identity and permissions still come from authentication and database ownership.
Older requests without a marker keep their existing authenticated boundary.
Selection/upload/preview responses also carry the viewer marker for client
validation. Neither raw session hashes nor buyer IDs are exposed by this marker.

Closing or hiding clears preview URLs immediately and aborts requests. Late
responses cannot restore an old preview. Reopening the same mounted form under
the same viewer reuses confirmed references; navigation/unmount drops local
state. A known account change blocks the old editor and requires refresh.
My reviews remounts on viewer/capability changes, and stale account suggestions
are withheld. Private orphan/expiry cleanup remains a separate backend task;
closing an uncertain operation never automatically deletes stored objects.

## Implemented staff decisions and public delivery

Migration `20261121030000` adds staff projection v5, per-photo decision and
preview RPCs, a shared waiting-queue/count predicate and approved-only public
projections. Every new RPC is service-role-only and invoker. Staff RPCs recheck
an onboarded Tasks owner; browser requests cannot choose shop or actor.

Tasks shows up to five ordered photos per current version. Owners can enlarge,
approve or reject each photo after its preview loads. Rejection requires a
private reason. A decision locks the review, checks its exact six-digit version,
updates one revision/photo association, records photo/revision/actor audit and
advances the review version atomically. A stale decision requires a fresh read;
an unknown outcome is never automatically repeated. Pending photos on pending
or published text keep the review in the waiting queue and badge after text
approval. Rejected text and withdrawn reviews do not create media-only work.

`GET /api/admin/reviews/photos` accepts exactly `reviewId`, `revisionId`,
`photoId` and `expectedUpdatedAt`. It requires owner access and refuses
cross-origin browser reads. `POST` accepts those four fields plus `action`
(`approve` or `reject`) and nullable `note`. Staff previews are restricted to the
current pending/published/latest revision and expire when the review changes.

Public SQL returns only approved photos on active approved text, with dimensions
and `/api/reviews/media/<review>/<revision>/<photo>` URLs. The Store pins the
shop and rechecks authorization before and after a bounded private download,
verifying exact size, SHA-256 and metadata consistency. A hidden, withdrawn,
deleted or replaced revision, or a rejected photo, makes its old path unavailable.
A deliberate restore/reapproval can restore an otherwise current path.
Previously downloaded bytes cannot be recalled from a viewer's device.

Public responses are WebP, `no-store` for browser and CDN, `no-referrer`,
`nosniff` and same-origin resource policy. The gallery bypasses the Next image
optimizer and offers retry on a failed enlarged image. No redirect, signed URL,
public bucket or legacy Judge.me host allowlist is involved. Public downloads
have an eight-pipeline per-process cap; staff previews have four. Collection
flags do not block already-published photo reads.

## Deletion and remaining operational limits

The Tasks policy-deletion action now removes the review's photo associations
and draft records transactionally, then tries to remove its private objects.
A failed Storage removal is reported; no automatic retry worker exists. This
is separate from buyer draft discard and withdrawal. See
[moderation](review-moderation.md#permanent-deletion).

Draft expiry prevents use but does not delete objects; failed Storage removal
has no retry worker. Cleanup, recovery and a hosted lifecycle rehearsal remain
operational work; they are not established by enabling attachments. See the
[roadmap](../planning/roadmap.md#14-store-reviews) for cleanup, retention and release evidence, and
[operations](../how-to/review-operations.md) for recovery procedures.

## Repeatable verification

From `apps/store`, synthetic server-free boundaries:

```sh
STORE_BASE_URL=http://127.0.0.1:39999 npx playwright test tests/review-photo-processing.spec.ts tests/review-photo-staging.spec.ts tests/review-photo-actions.spec.ts tests/review-photo-reader.spec.ts tests/review-photo-reads.spec.ts tests/review-photo-client.spec.ts tests/review-photo-viewer.spec.ts tests/public-review-photo.spec.ts --workers=1
```

For the buyer editor and real HTTP boundaries with synthetic accounts:

```sh
npx playwright test --config=playwright.review-photos.config.ts
npx playwright test --config=playwright.product-reviews.config.ts
```

The dedicated photo browser suite covers limits, upload/preview retry, retained
photo removal, stale versions, account changes, late responses, blob revocation
and responsive themes. The Store CI workflow includes these configurations and
processor/handler tests. Database profile tests cover atomic rollback, ownership,
claims, budgets, private reads, separate media decisions and public revocation;
run the two isolated profiles sequentially from the database guide. Tasks browser
tests cover preview/approve/reject, queue retention and stale decisions. These
tests do not establish live Shopify permissions or a hosted object-restore rehearsal.
