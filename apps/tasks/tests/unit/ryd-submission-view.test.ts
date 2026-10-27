import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupSubmissions, type RydSubmission } from "@/lib/ryd/matching";
import { derivePagination } from "@/lib/pagination";
import {
  rydResponseEvidence,
  rydSubmissionFileIds,
  rydSubmitterSearchText,
  sortRydSubmitters,
} from "@/lib/ryd/submission-view";
import { RydResponseCards } from "@/components/ryd/RydSubmissionDetails";
import { RydUnmatchedView } from "@/components/ryd/RydUnmatchedView";

function response(
  key: string,
  patch: Partial<RydSubmission> = {},
): RydSubmission {
  return {
    key,
    legalName: "Ryan Example",
    email: "ryan@example.test",
    submittedAt: "October 21",
    submittedAtIso: "2026-10-21T12:00:00Z",
    fileIds: [],
    socialText: "",
    socialLinks: [],
    otherAnswers: [],
    ...patch,
  };
}
const answers = [
  response("first", {
    fileIds: ["file-a", "file-a", "file-b"],
    socialText: "ok",
    otherAnswers: [
      { question: "Extra detail", answer: "Passport checked" },
      { question: "Extra detail", answer: "Gift for my son" },
    ],
  }),
  response("second", {
    legalName: "Ryan Alternate",
    fileIds: ["file-a", "file-b", "file-c", "file-d", "file-e", "file-f"],
    otherAnswers: [
      { question: "Delivery note", answer: "Leave with concierge" },
    ],
  }),
];

describe("RY-D submission views", () => {
  it("deduplicates uploads within and across responses without changing their order or source data", () => {
    const original = structuredClone(answers);
    expect(rydSubmissionFileIds(answers)).toEqual([
      "file-a",
      "file-b",
      "file-c",
      "file-d",
      "file-e",
      "file-f",
    ]);
    expect(answers).toEqual(original);
  });
  it("previews shared files once while preserving every response's references", () => {
    const displayed = rydResponseEvidence(answers);
    expect(displayed[0]).toEqual({
      submission: answers[0],
      preview: ["file-a", "file-b"],
      repeated: [],
    });
    expect(displayed[1]).toEqual({
      submission: answers[1],
      preview: ["file-c", "file-d", "file-e", "file-f"],
      repeated: ["file-a", "file-b"],
    });
    expect(displayed.flatMap((entry) => entry.preview)).toEqual(
      rydSubmissionFileIds(answers),
    );
  });
  it("renders all unique previews and full answers, including short notes and repeated question titles", () => {
    const markup = renderToStaticMarkup(
      createElement(RydResponseCards, { submissions: answers, complete: true }),
    );
    expect(markup.match(/<img /g)).toHaveLength(6);
    expect(markup).toContain("Passport checked");
    expect(markup).toContain("Gift for my son");
    expect(markup).toContain("Leave with concierge");
    expect(markup).toContain(">ok</blockquote>");
    expect(markup).toContain("Previously shown uploads");
    expect(markup.match(/aria-label="Preview uploaded image /g)).toHaveLength(6);
    expect(markup.match(/href="\/api\/ryd\/evidence\/file-a"/g)).toHaveLength(
      1,
    );
    expect(markup).toContain("Ryan Alternate");
  });
  it("makes both the table's extra-file count and each person's response details actionable", () => {
    const markup = renderToStaticMarkup(
      createElement(RydUnmatchedView, {
        submitters: groupSubmissions(answers),
        dismissed: [],
        contacts: {},
        layout: "table",
        orderOptions: [],
        linking: null,
        busy: null,
        contacting: null,
        onLink: () => {},
        onRemove: () => {},
        onRestore: () => {},
        onMarkContacted: () => {},
        selection: { selected: new Set<string>(), onToggle: () => {} },
      }),
    );
    expect(markup.match(/<img /g)).toHaveLength(4);
    expect(markup).toContain("View all uploaded files from Ryan Example");
    expect(markup).toContain("+2 more");
    expect(markup).toContain("View responses from Ryan Example");
    expect(markup).toContain('aria-label="Unmatched submission table"');
  });
  it("searches all responses in a group, including original answers and social links", () => {
    const submitter = groupSubmissions([
      ...answers,
      response("third", {
        socialText: "Only use this backup address",
        socialLinks: [
          {
            url: "https://example.test/ryan-profile",
            label: "Profile",
            platform: "web",
            handle: null,
          },
        ],
      }),
    ])[0];
    const haystack = rydSubmitterSearchText(submitter);
    for (const query of [
      "ryan alternate",
      "ryan@example.test",
      "passport checked",
      "extra detail",
      "concierge",
      "backup address",
      "example.test/ryan-profile",
    ])
      expect(haystack).toContain(query);
  });
  it("sorts by a person's newest response and breaks tied/missing dates by stable identity", () => {
    const people = groupSubmissions([
      response("old", {
        email: "z@example.test",
        submittedAtIso: "2026-10-19T12:00:00Z",
      }),
      response("new", {
        email: "z@example.test",
        submittedAtIso: "2026-10-22T12:00:00Z",
      }),
      response("tied-b", { email: "b@example.test" }),
      response("tied-a", { email: "a@example.test" }),
      response("missing", {
        email: "missing@example.test",
        submittedAtIso: "bad date",
      }),
    ]);
    expect(sortRydSubmitters(people).map((person) => person.email)).toEqual([
      "z@example.test",
      "a@example.test",
      "b@example.test",
      "missing@example.test",
    ]);
    expect(sortRydSubmitters([...people].reverse())).toEqual(
      sortRydSubmitters(people),
    );
    expect(people.map((person) => person.email)).toEqual([
      "z@example.test",
      "b@example.test",
      "a@example.test",
      "missing@example.test",
    ]);
  });
  it("pages whole people without splitting their responses and clamps a shortened last page", () => {
    const people = sortRydSubmitters(
      groupSubmissions([
        ...answers,
        ...Array.from({ length: 10 }, (_, i) =>
          response(`other-${i}`, { email: `ryan${i}@example.test` }),
        ),
      ]),
    );
    const first = derivePagination(1, 10, people.length);
    const second = derivePagination(2, 10, people.length);
    const shown = [
      ...people.slice(first.from, first.to + 1),
      ...people.slice(second.from, second.to + 1),
    ];
    expect(new Set(shown.map((person) => person.key)).size).toBe(11);
    expect(
      shown.find((person) => person.email === "ryan@example.test")?.submissions,
    ).toEqual(answers);
    expect(derivePagination(2, 10, people.length - 1).page).toBe(1);
  });
});
