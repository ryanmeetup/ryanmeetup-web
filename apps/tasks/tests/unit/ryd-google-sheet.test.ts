import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sheetSerial } from "@/lib/ryd/form-responses";
import type { RydSubmission } from "@/lib/ryd/matching";

vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: () => null }));
const submission: RydSubmission = {
  key: "saved",
  email: "ryan@example.test",
  legalName: "Ryan Example",
  submittedAt: "10/21/2026 12:00 PM",
  submittedAtIso: "2026-10-21T16:00:00Z",
  fileIds: [],
  socialText: "",
  socialLinks: [],
  otherAnswers: [],
};
const header = ["Timestamp", "Your email", "Legal name", "Verified?"];
const row = [
  sheetSerial(submission.submittedAtIso, "America/New_York"),
  submission.email,
  submission.legalName,
  "",
];

async function fixture() {
  const { encryptGoogleRefreshToken } =
    await import("@/lib/server/google-oauth");
  const { markRydSubmissionsVerified } =
    await import("@/lib/server/ryd-google");
  const connection = {
    id: "ryd_google",
    encrypted_refresh_token: encryptGoogleRefreshToken("synthetic"),
    account_email: "owner@example.test",
    connected_by: "actor",
    connected_at: "2026-10-21",
    updated_at: "2026-10-21",
  };
  const form = {
    title: "Synthetic form",
    linkedSheetId: "linked-sheet",
    questionTitles: ["Your email", "Legal name"],
    submissions: [submission],
  };
  const network = {
    tabs: [
      { properties: { sheetId: 0, title: "Summary", sheetType: "GRID" } },
      {
        properties: {
          sheetId: 77,
          title: "Ryan's responses",
          sheetType: "GRID",
        },
      },
    ],
    headers: new Map<number, unknown[]>([
      [0, ["Summary"]],
      [77, header],
    ]),
    values: [header, row] as unknown[][],
    updatedCells: 1,
    failWrite: false,
  };
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      init?.signal?.throwIfAborted();
      if (url.includes("oauth2.googleapis.com"))
        return Response.json({
          access_token: "synthetic-token",
          expires_in: 3600,
        });
      if (url.includes("batchGetByDataFilter")) {
        const { dataFilters } = JSON.parse(String(init?.body)) as {
          dataFilters: {
            gridRange: { sheetId: number; endRowIndex?: number };
          }[];
        };
        return Response.json({
          valueRanges: dataFilters.map((filter) => ({
            dataFilters: [filter],
            valueRange: {
              values:
                filter.gridRange.endRowIndex === 1
                  ? [network.headers.get(filter.gridRange.sheetId) ?? []]
                  : network.values,
            },
          })),
        });
      }
      if (url.includes("batchUpdateByDataFilter")) {
        if (network.failWrite) throw new Error("synthetic lost write response");
        return Response.json({ totalUpdatedCells: network.updatedCells });
      }
      return Response.json({
        properties: { timeZone: "America/New_York" },
        sheets: network.tabs,
      });
    },
  );
  vi.stubGlobal("fetch", fetcher);
  const writes = () =>
    fetcher.mock.calls.filter(([url]) =>
      String(url).includes("batchUpdateByDataFilter"),
    );
  return {
    markRydSubmissionsVerified,
    connection,
    form,
    network,
    fetcher,
    writes,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "synthetic-client");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv(
    "GOOGLE_CALENDAR_TOKEN_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("RY-D Google response sheet writes", () => {
  it("finds a non-first response tab and targets only the stable tab ID and verified cell", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      fetcher,
      writes,
    } = await fixture();
    const report = await mark(connection, form, [submission.key]);
    expect(report).toMatchObject({
      sheetId: 77,
      sheetTitle: "Ryan's responses",
      responses: [{ key: "saved", outcome: "updated", row: 2 }],
    });
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(String(writes()[0][1]?.body))).toEqual({
      valueInputOption: "RAW",
      data: [
        {
          dataFilter: {
            gridRange: {
              sheetId: 77,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
          },
          majorDimension: "ROWS",
          values: [["✅"]],
        },
      ],
    });
    for (const [, init] of fetcher.mock.calls.filter(([url]) =>
      String(url).includes("batchGetByDataFilter"),
    )) {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        valueRenderOption: "FORMULA",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      expect(init?.cache).toBe("no-store");
    }
  });
  it("does not choose among copied response tabs", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      network,
      writes,
    } = await fixture();
    network.headers.set(0, header);
    expect(await mark(connection, form, [submission.key])).toMatchObject({
      issue: "tab-ambiguous",
      responses: [{ outcome: "unchecked" }],
    });
    expect(writes()).toHaveLength(0);
  });
  it("revalidates headers before writing if columns change after tab selection", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      network,
      writes,
    } = await fixture();
    network.values[0] = ["Timestamp", "Unrelated data"];
    expect((await mark(connection, form, [submission.key])).issue).toBe(
      "tab-missing",
    );
    expect(writes()).toHaveLength(0);
  });
  it("reports every outcome and writes only the unique blank cell", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      network,
      writes,
    } = await fixture();
    const done = { ...submission, key: "done", email: "done@example.test" };
    const missing = {
      ...submission,
      key: "missing",
      email: "missing@example.test",
    };
    const ambiguous = {
      ...submission,
      key: "ambiguous",
      email: "ambiguous@example.test",
    };
    form.submissions.push(done, missing, ambiguous);
    network.values.push(
      [row[0], done.email, "Ryan Done", "✅"],
      [row[0], ambiguous.email],
      [row[0], ambiguous.email],
    );
    const report = await mark(connection, form, [
      ...form.submissions.map(({ key }) => key),
      "deleted",
    ]);
    expect(report.responses.map(({ outcome }) => outcome)).toEqual([
      "updated",
      "already-ticked",
      "missing",
      "ambiguous",
      "missing",
    ]);
    expect(JSON.parse(String(writes()[0][1]?.body)).data).toHaveLength(1);
  });
  it.each([true, false])(
    "reports uncertain writes without retrying (network failure %s)",
    async (failWrite) => {
      const {
        markRydSubmissionsVerified: mark,
        connection,
        form,
        network,
        writes,
      } = await fixture();
      network.failWrite = failWrite;
      network.updatedCells = 0;
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await mark(connection, form, [submission.key])).toMatchObject({
        issue: "write-unconfirmed",
        responses: [{ outcome: "unchecked", row: 2 }],
      });
      expect(writes()).toHaveLength(1);
    },
  );
  it("makes no request without pinned responses or a linked spreadsheet", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      fetcher,
    } = await fixture();
    expect((await mark(connection, form, [])).issue).toBe("not-required");
    expect(
      (
        await mark(connection, { ...form, linkedSheetId: null }, [
          submission.key,
        ])
      ).issue,
    ).toBe("no-linked-sheet");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("makes no write for already-ticked or unresolved responses", async () => {
    const {
      markRydSubmissionsVerified: mark,
      connection,
      form,
      network,
      writes,
    } = await fixture();
    network.values = [header, [...row.slice(0, 3), "✅"]];
    expect(
      (await mark(connection, form, [submission.key])).responses[0].outcome,
    ).toBe("already-ticked");
    network.values = [header];
    expect(
      (await mark(connection, form, [submission.key])).responses[0].outcome,
    ).toBe("missing");
    expect(writes()).toHaveLength(0);
  });
});
