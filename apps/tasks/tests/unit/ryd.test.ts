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
import {
  formIdFrom,
  parseRydFormResponses,
  sheetSerial,
} from "@/lib/ryd/form-responses";
import { rydSheetColumns } from "@/lib/ryd/sheet-columns";

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
    submittedAt: "10/14/2026, 1:00 PM",
    submittedAtIso: "2026-10-14T17:00:00Z",
    legalName: "Ryan Example",
    email: "ryan.example@test.dev",
    fileIds: [],
    socialText: "",
    socialLinks: [],
    otherAnswers: [],
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
    });
    expect(parsed.orders[2].raw.OrderTotal).toBe("1,036.75");
  });

  it("refuses a file that is not the order summary", () => {
    const parsed = parseRydOrderCsv("Timestamp,What is your legal name?\n");
    expect(parsed.ok).toBe(false);
  });

  it("preserves saved cells when a later file changes or drops a header", () => {
    const csv = rydOrderExportCsv(
      [" orderid ", "Verified?"],
      [
        {
          raw: { OrderId: "1001", Delivery: " Shipping " },
          status: "verified",
        },
      ],
    );
    expect(parseCsv(csv)).toEqual({
      headers: [" orderid ", "Verified?", "Delivery"],
      rows: [["1001", "✅", " Shipping "]],
    });
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

  it("reads a handle followed by its platform in brackets or after a dash", () => {
    expect(
      parseSocialLinks("Great_lake_runner (Instagram)").map((l) => l.url),
    ).toEqual(["https://www.instagram.com/great_lake_runner/"]);
    expect(parseSocialLinks("ryan.x - ig").map((l) => l.label)).toEqual([
      "@ryan.x",
    ]);
  });

  it("unwraps Instagram's login redirect", () => {
    const [link] = parseSocialLinks(
      "https://www.instagram.com/accounts/login/?next=https%3A%2F%2Fwww.instagram.com%2Fryan_x%3Fa%3Db&is_from_rle",
    );
    expect(link.handle).toBe("ryan_x");
  });

  it("survives malformed or foreign Instagram redirect destinations", () => {
    expect(() =>
      parseSocialLinks(
        "https://instagram.com/accounts/login/?next=http%3A%2F%2F%5B",
      ),
    ).not.toThrow();
    const links = parseSocialLinks(
      "https://instagram.com/accounts/login/?next=https://example.com/someone",
    );
    expect(links.some((link) => link.handle === "someone")).toBe(false);
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

  it("offers a gift as possible when the buyer used their own email", () => {
    expect(
      scoreSubmitter(
        order("Giftgiver", "Pat@test.dev", "1", "Pat"),
        one({ legalName: "Ryan Kidname", email: "pat@test.dev" }),
      ),
    ).toEqual({
      email: "pat@test.dev",
      confidence: "possible",
      reasons: ["Email matches", "A gift: the form names Ryan Kidname"],
    });
  });

  it("never suggests a gift on a name or near-miss email alone", () => {
    expect(
      scoreSubmitter(
        order("Perez", "jamie@test.dev", "1", "Jamie"),
        one({ legalName: "Ryan Pêrez", email: "ryan.perez@test.dev" }),
      ),
    ).toBeNull();
    expect(
      scoreSubmitter(
        order("Giftgiver", "pat@test.dev", "1", "Pat"),
        one({ legalName: "Ryan Kidname", email: "pat1@test.dev" }),
      ),
    ).toBeNull();
  });

  it("says when the order's first name is a middle name on the form", () => {
    const result = scoreSubmitter(
      order("Fox", "rf@test.dev"),
      one({ legalName: "Steven Ryan Fox", email: "rf@test.dev" }),
    );
    expect(result?.confidence).toBe("strong");
    expect(result?.reasons).toEqual([
      "Email matches",
      "Full name matches, with Ryan as a middle name",
    ]);
    expect(
      scoreSubmitter(
        order("Fox", "rf@test.dev"),
        one({ legalName: "Ryan Steven Fox", email: "rf@test.dev" }),
      )?.reasons,
    ).toEqual(["Email matches", "Full name matches"]);
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

  it("keeps responses without contact addresses as distinct people", () => {
    const groups = groupSubmissions([
      submission({ key: "no-email-one", email: "", legalName: "Ryan One" }),
      submission({ key: "no-email-two", email: "", legalName: "Ryan Two" }),
    ]);
    expect(
      groups.map((group) => [group.key, group.submissions.length]),
    ).toEqual([
      ["response:no-email-one", 1],
      ["response:no-email-two", 1],
    ]);
    expect(scoreSubmitter(order("One", ""), groups[0])).toBeNull();
    expect(suggestMatches([order("One", "")], groups).size).toBe(0);
  });

  it("does not combine different people's first and last names into a strong match", () => {
    const [submitter] = groupSubmissions([
      submission({ legalName: "Ryan Smith" }),
      submission({ legalName: "Jamie Example" }),
    ]);
    expect(
      scoreSubmitter(order("Example", "ryan.example@test.dev"), submitter),
    ).toEqual({
      email: "ryan.example@test.dev",
      confidence: "possible",
      reasons: ["Email matches", "Form gives the surname Smith"],
    });
  });

  it("offers the buyer's own email as possible when the surname differs", () => {
    expect(
      scoreSubmitter(
        order("Smith", "rs@test.dev"),
        one({ legalName: "Ryan Smyth", email: "rs@test.dev" }),
      ),
    ).toEqual({
      email: "rs@test.dev",
      confidence: "possible",
      reasons: ["Email matches", "Surname spelled Smyth on the form"],
    });
  });

  it("treats one mailbox written differently as the same email", () => {
    expect(
      scoreSubmitter(
        order("Fox", "ryan.fox+ryd@gmail.com"),
        one({ legalName: "Ryan Fox", email: "ryanfox@googlemail.com" }),
      ),
    ).toEqual({
      email: "ryanfox@googlemail.com",
      confidence: "strong",
      reasons: ["Same mailbox, written differently", "Full name matches"],
    });
    // Dots only collapse at Gmail.
    expect(
      scoreSubmitter(
        order("Fox", "ryan.fox@test.dev"),
        one({ legalName: "Ryan Fox", email: "ry.anfox@test.dev" }),
      )?.reasons[0],
    ).not.toBe("Same mailbox, written differently");
  });

  it("follows the order number or order email quoted on the form", () => {
    const quoted = (answer: string) =>
      one({
        legalName: "Ryan Kidname",
        email: "ryan.kid@test.dev",
        otherAnswers: [{ question: "Anything else?", answer }],
      });
    expect(
      scoreSubmitter(
        order("Giftgiver", "pat@test.dev", "9372657", "Pat"),
        quoted("My mom ordered it, order #9372657."),
      ),
    ).toEqual({
      email: "ryan.kid@test.dev",
      confidence: "possible",
      reasons: [
        "Form mentions order 9372657",
        "A gift: the form names Ryan Kidname",
      ],
    });
    expect(
      scoreSubmitter(
        order("Kidname", "other.inbox@test.dev"),
        quoted("I bought it with other.inbox@test.dev"),
      ),
    ).toEqual({
      email: "ryan.kid@test.dev",
      confidence: "strong",
      reasons: ["Form gives the order email", "Full name matches"],
    });
    // Part of a longer number or address is not a quote.
    expect(
      scoreSubmitter(
        order("Giftgiver", "pat@test.dev", "93726", "Pat"),
        quoted("Order 9372657, from not.pat@test.dev"),
      ),
    ).toBeNull();
  });

  it("offers the same email name at another provider as possible", () => {
    expect(
      scoreSubmitter(
        order("Guardiola", "rguardy2012@aol.com"),
        one({ legalName: "Ryan Guardiola", email: "rguardy2012@gmail.com" }),
      )?.reasons,
    ).toEqual(["Same email name at another provider", "Full name matches"]);
    // A short, common email name says too little on its own.
    expect(
      scoreSubmitter(
        order("Guardiola", "ryan@aol.com"),
        one({ legalName: "Ryan Guardiola", email: "ryan@gmail.com" }),
      )?.confidence,
    ).toBe("weak");
  });

  it("accepts a misspelled surname only alongside a near email", () => {
    expect(
      scoreSubmitter(
        order("Burch", "rburch@test.dev"),
        one({ legalName: "Ryan Burck", email: "rburch@test.dew" }),
      )?.reasons,
    ).toEqual([
      "Email differs by one character",
      "Surname spelled Burck on the form",
    ]);
    expect(
      scoreSubmitter(
        order("Burch", "rib673@test.dev"),
        one({ legalName: "Ryan Burns", email: "ryanburns@test.dev" }),
      ),
    ).toBeNull();
  });

  it("prefers a quoted order over an equally confident name match", () => {
    const submitters = groupSubmissions([
      submission({
        legalName: "Ryan Johnson",
        email: "rj@test.dev",
        otherAnswers: [{ question: "Order number", answer: "10002" }],
      }),
    ]);
    const suggestions = suggestMatches(
      [
        order("Johnson", "a@test.dev", "10001"),
        order("Johnson", "b@test.dev", "10002"),
      ],
      submitters,
    );
    expect(suggestions.get("10002")?.confidence).toBe("strong");
    expect(suggestions.has("10001")).toBe(false);
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

describe("parseRydFormResponses", () => {
  const form = {
    linkedSheetId: "sheet-id",
    items: [
      {
        title: "What is your legal name?",
        questionItem: { question: { questionId: "q-name" } },
      },
      {
        title: "What is your email address?",
        questionItem: { question: { questionId: "q-email" } },
      },
      {
        title: "Upload any files that may aid in your ry-dentification here",
        questionItem: {
          question: { questionId: "q-files", fileUploadQuestion: {} },
        },
      },
      {
        title: "Or paste links to social media here",
        questionItem: { question: { questionId: "q-social" } },
      },
      // A question added to the form later: shown, never dropped.
      {
        title: "Which chapter do you go to?",
        questionItem: { question: { questionId: "q-new" } },
      },
      { title: "A section header with no question" },
    ],
  };
  const response = {
    responseId: "resp-1",
    lastSubmittedTime: "2026-10-15T04:03:30.123Z",
    answers: {
      "q-name": { textAnswers: { answers: [{ value: "Ryan  Example" }] } },
      "q-email": {
        textAnswers: { answers: [{ value: "Ryan.Example@Test.dev " }] },
      },
      "q-files": {
        fileUploadAnswers: {
          answers: [{ fileId: "1abcdefghijk" }, { fileId: "2abcdefghijk" }],
        },
      },
      "q-social": { textAnswers: { answers: [{ value: "IG @ryanex" }] } },
      "q-new": {
        textAnswers: { answers: [{ value: "Detroit, find me at @ryandet" }] },
      },
    },
  };

  it("reads each answer by what its question asks", () => {
    const [submission] = parseRydFormResponses(form, [
      response,
      { answers: {} },
    ]);
    expect(submission).toMatchObject({
      key: "resp-1",
      legalName: "Ryan Example",
      email: "ryan.example@test.dev",
      fileIds: ["1abcdefghijk", "2abcdefghijk"],
      submittedAtIso: "2026-10-15T04:03:30.123Z",
      submittedAt: "10/15/2026, 12:03 AM",
      otherAnswers: [
        {
          question: "Which chapter do you go to?",
          answer: "Detroit, find me at @ryandet",
        },
      ],
    });
    expect(submission.socialLinks.map((link) => link.handle)).toEqual(
      expect.arrayContaining(["ryanex", "ryandet"]),
    );
  });

  it("falls back to the address the form collected itself", () => {
    const [submission] = parseRydFormResponses(
      { items: form.items.filter((item) => !item.title?.includes("email")) },
      [{ ...response, respondentEmail: "Signed.In@test.dev" }],
    );
    expect(submission.email).toBe("signed.in@test.dev");
  });
});

describe("response sheet lookup", () => {
  it("counts days as the sheet does, in the sheet's own zone", () => {
    // 10/15/2026 0:03:30 in New York, as the sheet's Timestamp column holds it.
    const expected = Date.UTC(2026, 9, 15, 0, 3, 30) / 86_400_000 + 25_569;
    expect(sheetSerial("2026-10-15T04:03:30Z", "America/New_York")).toBeCloseTo(
      expected,
      8,
    );
  });

  it("finds the columns it writes by header", () => {
    expect(
      rydSheetColumns([
        "Timestamp",
        "What is your legal name?",
        "What is your email address?",
        5,
        "Verified?",
      ]),
    ).toEqual({ timestamp: 0, email: 2, verified: 4 });
  });
});

describe("formIdFrom", () => {
  it("takes the editor link or the bare ID, never the public link", () => {
    const id = "11fyQNBGVKDKGNeD4e1D-Ltaze1epokTuDhg2tqvbW0U";
    expect(
      formIdFrom(`https://docs.google.com/forms/d/${id}/edit#responses`),
    ).toBe(id);
    expect(formIdFrom(id)).toBe(id);
    expect(
      formIdFrom("https://docs.google.com/forms/d/e/1FAIpQLSexample/viewform"),
    ).toBeNull();
    expect(formIdFrom("not a form")).toBeNull();
  });
});
