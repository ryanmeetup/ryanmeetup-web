import { describe, expect, it } from "vitest";
import { derivePagination, parsePagination } from "@ryanmeetup/utils";

describe("pagination", () => {
  it("uses canonical defaults for missing and malformed input", () => {
    expect(
      parsePagination(new URLSearchParams("page=nope&pageSize=-5")),
    ).toEqual({
      requestedPage: 1,
      pageSize: 1,
    });
  });

  it("clamps page sizes and out-of-range pages", () => {
    const request = parsePagination(
      new URLSearchParams("page=99&pageSize=1000"),
    );
    expect(request).toEqual({ requestedPage: 99, pageSize: 100 });
    expect(
      derivePagination(request.requestedPage, request.pageSize, 205),
    ).toMatchObject({
      page: 3,
      pageSize: 100,
      totalCount: 205,
      totalPages: 3,
      from: 200,
      to: 299,
    });
  });

  it("keeps an empty result on page one", () => {
    expect(derivePagination(4, 25, 0)).toMatchObject({
      page: 1,
      totalPages: 1,
      from: 0,
      to: 24,
    });
  });
});
