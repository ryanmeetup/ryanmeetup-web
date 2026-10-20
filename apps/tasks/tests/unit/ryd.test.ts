import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "@/lib/ryd/csv";
import {
  groupSubmissions,
  scoreSubmitter,
  suggestMatches,
  type RydSubmission,
} from "@/lib/ryd/matching";
import {
  nameIncludes,
  parseDriveFileIds,
  parseSocialLinks,
} from "@/lib/ryd/normalize";
import { parseRydOrderCsv, rydOrderExportCsv } from "@/lib/ryd/orders";
import { parseRydSubmissions } from "@/lib/ryd/submissions";

// Synthetic rows shaped like the fulfillment export. No real customer appears.
const ORDER_CSV = [
  "Store Name,Sales Order,Organization,OrderId,OrderDate,BillFirstName,BillLastName,BillEmail,OrderTotal,OrderItems,Delivery,Preferred Method of Contact,Verified?",
  "RY-Ds,600001,Ryan Meet Up,1001,10/14/2026 3:34 PM,Ryan,Example,ryan.example@test.dev,36.75,1,Shipping,Email,✅",
  "RY-Ds,600001,Ryan Meet Up,1002,10/14/2026 4:02 PM,Ryan ,Sample ,Ryan.Sample@Test.dev,36.75,1,Shipping,Phone,",
  'RY-Ds,600001,Ryan Meet Up,1003,10/14/2026 5:14 PM,Pat,Giftgiver,pat@test.dev,"1,036.75",1,Shipping,Email,',
  "RY-Ds,600001,Ryan Meet Up,1002,10/14/2026 4:02 PM,Ryan,Sample,ryan.sample@test.dev,36.75,1,Shipping,Phone,",
].join("\n");

function submission(overrides: Partial<RydSubmission>): RydSubmission {
  return {
    key: `${overrides.email}|t`,
    row: 2,
    submittedAt: "10/14/2026 13:00:00",
    legalName: "Ryan Example",
    email: "ryan.example@test.dev",
    fileIds: [],
    socialText: "",
    socialLinks: [],
    verified: false,
    ...overrides,
  };
}

const order = (
  lastName: string,
  email: string,
  orderId = "1",
  firstName = "Ryan",
) => ({
  orderId,
  firstName,
  lastName,
  email,
});

describe("csv", () => {
  it("round-trips quoted cells, embedded commas and the tick mark", () => {
    const table = parseCsv('a,b,c\r\n"x, y","say ""hi""",✅\r\n');
    expect(table.rows).toEqual([["x, y", 'say "hi"', "✅"]]);
    expect(serializeCsv(table)).toBe('a,b,c\r\n"x, y","say ""hi""",✅\r\n');
  });

  it("drops a byte-order mark and blank trailing lines", () => {
    expect(parseCsv("﻿a,b\n1,2\n\n").headers).toEqual(["a", "b"]);
  });
});

describe("parseRydOrderCsv", () => {
  it("reads orders, normalizes email, keeps raw cells and reports duplicates", () => {
    const parsed = parseRydOrderCsv(ORDER_CSV);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.orders.map((o) => o.orderId)).toEqual([
      "1001",
      "1002",
      "1003",
    ]);
    expect(parsed.duplicates).toEqual(["1002"]);
    expect(parsed.orders[0].verified).toBe(true);
    expect(parsed.orders[1]).toMatchObject({
      firstName: "Ryan",
      lastName: "Sample",
      email: "ryan.sample@test.dev",
      contactMethod: "Phone",
    });
    expect(parsed.orders[2].raw.OrderTotal).toBe("1,036.75");
  });

  it("refuses a file that is not the order summary", () => {
    const parsed = parseRydOrderCsv("Timestamp,What is your legal name?\n");
    expect(parsed.ok).toBe(false);
  });

  it("exports fulfillment's own columns with Verified? from the decision", () => {
    const parsed = parseRydOrderCsv(ORDER_CSV);
    if (!parsed.ok) throw new Error(parsed.error);
    const csv = rydOrderExportCsv(
      parsed.headers,
      parsed.orders.map((o, index) => ({
        raw: o.raw,
        status: index === 1 ? "verified" : "pending",
      })),
    );
    const table = parseCsv(csv);
    expect(table.headers).toEqual(parsed.headers);
    expect(table.rows.map((row) => row.at(-1))).toEqual(["", "✅", ""]);
    // Every other cell is exactly what fulfillment sent, untrimmed.
    expect(table.rows[1].slice(0, -1)).toEqual(
      parsed.headers.slice(0, -1).map((h) => parsed.orders[1].raw[h]),
    );
  });
});

describe("normalize", () => {
  it("compares names without accents, case or apostrophe style", () => {
    expect(nameIncludes("Ryan Pêrez", "Perez")).toBe(true);
    expect(nameIncludes("Ryan Patrick O’Shea", "O'Shea")).toBe(true);
    expect(nameIncludes("RYAN SHUSTER-CONLEY", "Shuster-Conley")).toBe(true);
    expect(nameIncludes("Ryan Johnson", "Johnston")).toBe(false);
  });

  it("finds profiles in pasted links, bare domains and written handles", () => {
    const links = parseSocialLinks(
      "https://instagram.com/some_ryan?utm_source=qr Insta: @other.ryan x.com/ryanx; Ryanvalley on insta",
    );
    expect(links.map((l) => l.handle)).toEqual(
      expect.arrayContaining([
        "some_ryan",
        "other.ryan",
        "ryanx",
        "ryanvalley",
      ]),
    );
    expect(links.find((l) => l.handle === "some_ryan")?.url).toBe(
      "https://www.instagram.com/some_ryan/",
    );
  });

  it("unwraps Instagram's login redirect", () => {
    const [link] = parseSocialLinks(
      "https://www.instagram.com/accounts/login/?next=https%3A%2F%2Fwww.instagram.com%2Fryan_x%3Fa%3Db&is_from_rle",
    );
    expect(link.handle).toBe("ryan_x");
  });

  it("does not mistake an email address or a dotted handle for a website", () => {
    expect(parseSocialLinks("reach me at ryan@test.dev")).toEqual([]);
    expect(
      parseSocialLinks(
        "Instagram: ryan.mitro Facebook: https://www.facebook.com/share/abc/",
      ).map((l) => l.label),
    ).toEqual(["Facebook", "@ryan.mitro"]);
  });

  it("reads Drive file ids from the upload column", () => {
    expect(
      parseDriveFileIds(
        "https://drive.google.com/open?id=1abcDEF_ghij-k, https://drive.google.com/open?id=2zyxwvutsrq",
      ),
    ).toEqual(["1abcDEF_ghij-k", "2zyxwvutsrq"]);
  });
});

describe("matching", () => {
  const one = (s: Partial<RydSubmission>) =>
    groupSubmissions([submission(s)])[0];

  it("is strong on the same email, ignoring case", () => {
    expect(
      scoreSubmitter(order("Example", "Ryan.Example@test.dev"), one({}))
        ?.confidence,
    ).toBe("strong");
  });

  it("offers a mistyped email or domain as possible", () => {
    expect(
      scoreSubmitter(
        order("Kay", "ryan.k.1493@test.dev"),
        one({ legalName: "Ryan Kay", email: "ryan.k1493@test.dev" }),
      )?.confidence,
    ).toBe("possible");
    expect(
      scoreSubmitter(
        order("Evans", "rsevans@hitmail.com"),
        one({ legalName: "Ryan Evans", email: "rsevans@hotmail.com" }),
      )?.reasons[0],
    ).toMatch(/one character|domain/);
  });

  it("links a different email through a matching social handle", () => {
    const result = scoreSubmitter(
      order("Daly", "pineapple@test.dev"),
      one({
        legalName: "Ryan Daly",
        email: "something.else@test.dev",
        socialLinks: parseSocialLinks("https://www.instagram.com/pineapple/"),
      }),
    );
    expect(result?.confidence).toBe("possible");
  });

  it("never suggests a gift order whose buyer has another surname", () => {
    expect(
      scoreSubmitter(
        order("Giftgiver", "pat@test.dev", "1", "Pat"),
        one({ legalName: "Ryan Kidname", email: "pat@test.dev" }),
      ),
    ).toBeNull();
  });

  it("never suggests a parent who shares the Ryan's surname", () => {
    expect(
      scoreSubmitter(
        order("Perez", "jamie@test.dev", "1", "Jamie"),
        one({ legalName: "Ryan Pêrez", email: "jamie@test.dev" }),
      ),
    ).toBeNull();
  });

  it("accepts a first-name-only form when the email matches", () => {
    expect(
      scoreSubmitter(
        order("Sloan", "rs@test.dev"),
        one({ legalName: "Ryan", email: "rs@test.dev" }),
      )?.reasons,
    ).toEqual(["Email matches", "Form gives only a first name"]);
  });

  it("groups duplicate submissions from one address", () => {
    const groups = groupSubmissions([
      submission({ key: "a" }),
      submission({ key: "b" }),
      submission({ key: "c", email: "other@test.dev" }),
    ]);
    expect(groups.map((g) => g.submissions.length)).toEqual([2, 1]);
  });

  it("keeps two same-name orders from sharing one submitter", () => {
    const submitters = groupSubmissions([
      submission({ legalName: "Ryan Johnson", email: "rj.one@test.dev" }),
    ]);
    const suggestions = suggestMatches(
      [
        order("Johnson", "different@test.dev", "A"),
        order("Johnson", "rj.one@test.dev", "B"),
      ],
      submitters,
    );
    expect(suggestions.get("B")?.confidence).toBe("strong");
    expect(suggestions.has("A")).toBe(false);
  });

  it("skips submitters already linked to an order", () => {
    const submitters = groupSubmissions([submission({})]);
    const suggestions = suggestMatches(
      [order("Example", "ryan.example@test.dev")],
      submitters,
      new Set(["ryan.example@test.dev"]),
    );
    expect(suggestions.size).toBe(0);
  });
});

describe("parseRydSubmissions", () => {
  it("finds the form's columns by question text", () => {
    const parsed = parseRydSubmissions([
      [
        "Timestamp",
        "What is your legal name?",
        "What is your email address?",
        "Upload any files that may aid in your ry-dentification here",
        "Or paste links to social media here",
        "Verified?",
      ],
      [
        "10/14/2026 13:05:54",
        "Ryan  Example",
        "Ryan.Example@test.dev",
        "https://drive.google.com/open?id=1abcdefghijk",
        "IG @ryanex",
        "✅",
      ],
      ["", "", "", "", "", ""],
    ]);
    expect(parsed?.submissions).toHaveLength(1);
    expect(parsed?.submissions[0]).toMatchObject({
      row: 2,
      legalName: "Ryan Example",
      email: "ryan.example@test.dev",
      fileIds: ["1abcdefghijk"],
      verified: true,
      key: "ryan.example@test.dev|10/14/2026 13:05:54",
    });
    expect(parsed?.columns.verified).toBe(5);
  });
});
