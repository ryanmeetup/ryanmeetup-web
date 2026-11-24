/**
 * A rating is judged (the "Top rated" label, the shop-wide rating) only from this
 * many published reviews. Below it, one outlier moves the average too far: a single
 * 1-star among 5-stars still leaves five reviews at 4.2, where three would sink to
 * 3.7. Cards still show any rating with its count, so a shopper can weigh it.
 *
 * Its own module so client code (the home band) can read it without importing
 * the server-only review storage behind `listing-ratings`.
 */
export const MIN_LISTING_RATING_REVIEWS = 5;
