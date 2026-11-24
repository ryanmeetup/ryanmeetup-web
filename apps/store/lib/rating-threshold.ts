/**
 * Cards show a rating only from this many published reviews. Below it, one
 * outlier moves the average too far: a single 1-star among 5-stars still
 * leaves five reviews at 4.2, where three would sink to 3.7.
 *
 * Its own module so client code (the home band) can read it without importing
 * the server-only review storage behind `listing-ratings`.
 */
export const MIN_LISTING_RATING_REVIEWS = 5;
