import { describe, expect, it } from "vitest";
import { decodeCsvBytes, parseCsv } from "@/lib/ryd/csv";
import { parseRydOrderCsv } from "@/lib/ryd/orders";

describe("RY-D strict import parsing", () => {
  it("rejects duplicate headers and order numbers the database cannot store", () => {
    expect(
      parseRydOrderCsv(
        "OrderId,orderid,BillFirstName,BillLastName,BillEmail,Verified?\n",
      ).ok,
    ).toBe(false);
    expect(
      parseRydOrderCsv(
        `OrderId,BillFirstName,BillLastName,BillEmail,Verified?\n${"x".repeat(65)},Ryan,Example,r@example.com,`,
      ).ok,
    ).toBe(false);
  });

  it.each([
    'a,b\n"unclosed,b',
    'a,b\n"closed"garbage,b',
    'a,b\none"two,b',
    "a,b\none,two,three",
    "a,b\none",
  ])("rejects malformed records: %s", (csv) => {
    expect(() => parseCsv(csv)).toThrow();
  });
  it("preserves valid quoted newlines and closing empty cells", () => {
    expect(parseCsv('a,b\r\n"one\r\ntwo",""').rows).toEqual([
      ["one\r\ntwo", ""],
    ]);
  });
  it("reports incomplete order rows rather than silently skipping them", () => {
    const result = parseRydOrderCsv(
      "OrderId,BillFirstName,BillLastName,BillEmail,Verified?\n,Ryan,Example,ryan@example.test,\n",
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("OrderId"),
    });
  });
  it("surfaces quote errors through the import result", () => {
    expect(
      parseRydOrderCsv(
        'OrderId,BillFirstName,BillLastName,BillEmail,Verified?\n1001,"unclosed',
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("not closed"),
    });
  });

  it("reads Chipply's Excel text wrappers as their inner text", () => {
    expect(parseCsv('a,b\n="607227",="0012"').rows).toEqual([
      ["607227", "0012"],
    ]);
    expect(parseCsv('a,b\n"=""607227""",x').rows).toEqual([["607227", "x"]]);
    // Only the whole-cell wrapper counts; anything else stays strict.
    expect(() => parseCsv('a\n="607227"x')).toThrow();
    expect(parseCsv('a\n"=""one"" and ""two"""').rows).toEqual([
      ['="one" and "two"'],
    ]);
  });

  it("decodes UTF-8 and falls back to Windows-1252", () => {
    const utf8 = new TextEncoder().encode("Pérez");
    expect(decodeCsvBytes(utf8)).toBe("Pérez");
    // "Pérez" as Chipply writes it: é is the single byte 0xE9.
    const cp1252 = new Uint8Array([0x50, 0xe9, 0x72, 0x65, 0x7a]);
    expect(decodeCsvBytes(cp1252)).toBe("Pérez");
  });
});
