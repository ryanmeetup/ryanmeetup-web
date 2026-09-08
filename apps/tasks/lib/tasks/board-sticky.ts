/**
 * The board scrolls horizontally, which makes it a scroll container on both
 * axes — so `position: sticky` inside a column measures itself against the
 * board's own scrollport instead of the page, and never sticks while the
 * window scrolls. The column headings are pinned by hand instead: this works
 * out how far a heading has to slide down its column to rest below the app
 * header, and refuses to push it past the bottom of its own column.
 */
export function boardStickyOffset({
  columnTop,
  columnHeight,
  headerTop,
  headerHeight,
  pinTop,
  gap = 0,
}: {
  /** Column top edge in viewport coordinates. */
  columnTop: number;
  /** Column padding-box height. */
  columnHeight: number;
  /** Heading offset from the column's padding edge, with nothing applied. */
  headerTop: number;
  headerHeight: number;
  /** Viewport y the heading should come to rest under. */
  pinTop: number;
  /**
   * Space to keep between the app header and a pinned heading — the page's own
   * top padding, so the board holds the inset it has when scrolled to the top
   * rather than riding up against the header.
   */
  gap?: number;
}) {
  const travel = pinTop + gap - (columnTop + headerTop);
  if (travel <= 0) return 0;
  // Leave the same gap at the bottom of the column that the heading rests in
  // at the top, so a short column never wears its heading as a footer.
  const limit = columnHeight - headerHeight - headerTop * 2;
  return Math.max(0, Math.min(travel, limit));
}
