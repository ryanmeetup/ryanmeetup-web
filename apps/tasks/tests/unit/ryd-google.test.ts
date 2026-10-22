import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleForm, GoogleFormResponse } from "@/lib/ryd/form-responses";

vi.mock("@/lib/server/admin-client", () => ({ getAdminClient: () => null }));

const formId = "synthetic-form";
const files = Array.from({ length: 24 }, (_, i) => `uploadedFile${i}`);
const form: GoogleForm = {
  info: { title: "Synthetic verification" },
  items: [{
    questionItem: { question: { questionId: "files", fileUploadQuestion: {} } },
  }],
};
const responses = {
  responses: [{
    responseId: "synthetic-response",
    answers: {
      files: { fileUploadAnswers: { answers: files.map((fileId) => ({ fileId })) } },
    },
  }],
};

async function fixture() {
  const { encryptGoogleRefreshToken } = await import("@/lib/server/google-oauth");
  const google = await import("@/lib/server/ryd-google");
  const connection = {
    id: "ryd_google",
    encrypted_refresh_token: encryptGoogleRefreshToken("synthetic-refresh-token"),
    account_email: "form@example.com",
    connected_by: "synthetic-user",
    connected_at: "2026-10-21T12:00:00Z",
    updated_at: "2026-10-21T12:00:00Z",
  };
  const network: {
    latencyMs: number;
    page: { responses: GoogleFormResponse[]; nextPageToken?: string };
    form: GoogleForm;
  } = { latencyMs: 10, page: responses, form };
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, network.latencyMs);
      function abort() {
        clearTimeout(timer);
        reject(signal?.reason);
      }
      signal?.addEventListener("abort", abort, { once: true });
    });
    const url = String(input);
    if (url.includes("oauth2.googleapis.com"))
      return Response.json({
        access_token: "synthetic-access-token", expires_in: 3600,
      });
    if (url.includes("forms.googleapis.com"))
      return Response.json(
        /\/forms\/[^/]+$/.test(new URL(url).pathname) ? network.form : network.page,
      );
    if (url.includes("alt=media")) return new Response("synthetic image");
    return Response.json({ name: "synthetic.png", mimeType: "image/png" });
  });
  vi.stubGlobal("fetch", fetcher);
  return { ...google, connection, fetcher, network };
}

describe("RY-D Google reads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "synthetic-client");
    vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "synthetic-secret");
    vi.stubEnv("GOOGLE_CALENDAR_TOKEN_KEY", Buffer.alloc(32, 7).toString("base64"));
    // Node's native AbortSignal.timeout uses its own clock. Keep its browser
    // semantics while advancing network deadlines with the test clock.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("Timed out", "TimeoutError")),
        ms,
      );
      return controller.signal;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("measures a queue load followed by 24 evidence files", async () => {
    const { readRydSubmissions, fetchRydEvidence, connection, fetcher } = await fixture();
    const queue = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    await queue;
    const started = Date.now();
    const thumbnails = Promise.all(
      files.map(async (fileId) => {
        const { submissions } = await readRydSubmissions(connection, formId);
        expect(submissions[0].fileIds).toContain(fileId);
        const evidence = await fetchRydEvidence(connection, fileId);
        await new Response(evidence.body).text();
        return Date.now() - started;
      }),
    );
    await vi.advanceTimersByTimeAsync(100);
    const latencies = await thumbnails;
    const calls = fetcher.mock.calls.map(([url]) => String(url));
    const measured = {
      requests: calls.length,
      tokens: calls.filter((url) => url.includes("oauth2.googleapis.com")).length,
      forms: calls.filter((url) => url.includes("forms.googleapis.com")).length,
      thumbnailLatencyMs: Math.max(...latencies),
    };
    // Baseline: 147 requests, 49 token refreshes, 50 Forms calls, 60 ms/file
    // with the same synthetic ten-millisecond network legs.
    expect(measured).toEqual({
      requests: 51, tokens: 1, forms: 2, thumbnailLatencyMs: 20,
    });
  });

  it("coalesces cold concurrent reads and reads every response page", async () => {
    const { readRydSubmissions, connection, fetcher, network } = await fixture();
    const initial = network.page;
    network.page = { ...initial, nextPageToken: "second-page" };
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, init) => {
      const response = await original(url, init);
      return String(url).includes("pageToken=second-page")
        ? Response.json({
            responses: [{ ...initial.responses[0], responseId: "second-response" }],
          })
        : response;
    });
    const reads = Promise.all(
      Array.from({ length: 24 }, () => readRydSubmissions(connection, formId)),
    );
    await vi.advanceTimersByTimeAsync(100);
    const results = await reads;
    expect(results.every((result) => result.submissions.length === 2)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls.every(([, init]) => init?.cache === "no-store")).toBe(true);
  });

  it("expires answers without extending retention on a cache hit", async () => {
    const { readRydSubmissions, connection, fetcher, network } = await fixture();
    const first = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    await first;
    await vi.advanceTimersByTimeAsync(5000);
    network.page = { responses: [] };
    expect((await readRydSubmissions(connection, formId)).submissions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    const second = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    expect((await second).submissions).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it("bypasses retained answers for provenance checks and explicit refreshes", async () => {
    const { readRydSubmissions, connection, network, fetcher } = await fixture();
    const first = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    await first;
    network.page = { responses: [] };
    const fresh = readRydSubmissions(connection, formId, { fresh: true });
    await vi.advanceTimersByTimeAsync(100);
    expect((await fresh).submissions).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("isolates form IDs, replacement credentials, and connection revisions", async () => {
    const { readRydSubmissions, connection, fetcher } = await fixture();
    const { encryptGoogleRefreshToken } = await import("@/lib/server/google-oauth");
    for (const [current, id] of [
      [connection, formId],
      [connection, "another-form"],
      [{ ...connection, updated_at: "2026-10-21T13:00:00Z" }, formId],
      [{ ...connection, encrypted_refresh_token: encryptGoogleRefreshToken("replacement") }, formId],
    ] as const) {
      const read = readRydSubmissions(current, id);
      await vi.advanceTimersByTimeAsync(100);
      await read;
    }
    expect(fetcher).toHaveBeenCalledTimes(11);
  });

  it("does not retain failed reads", async () => {
    const { readRydSubmissions, connection, fetcher } = await fixture();
    fetcher.mockRejectedValueOnce(new Error("synthetic outage"));
    await expect(readRydSubmissions(connection, formId)).rejects.toThrow("synthetic outage");
    const retry = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    expect((await retry).submissions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("returns mapping warnings without discarding ambiguous answers or uploads", async () => {
    const { readRydSubmissions, connection, network } = await fixture();
    network.form = { ...form, items: [
      ...form.items!,
      { title: "Legal name", questionItem: { question: { questionId: "name" } } },
      { title: "Full name", questionItem: { question: { questionId: "otherName" } } },
    ] };
    network.page = { responses: [{ ...network.page.responses[0], answers: {
      ...network.page.responses[0].answers,
      name: { textAnswers: { answers: [{ value: "Ryan Fixture" }] } },
      otherName: { textAnswers: { answers: [{ value: "Ryan Other" }] } },
    } }] };
    const read = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    const result = await read;
    expect(result.warnings.join(" ")).toContain("2 possible legal-name questions");
    expect(result.submissions[0].legalName).toBe("");
    expect(result.submissions[0].otherAnswers).toContainEqual({ question: "Full name", answer: "Ryan Other" });
    expect(result.submissions[0].fileIds).toEqual(files);
  });

  it("does not retain form results exceeding four MiB of serialized data", async () => {
    const { readRydSubmissions, connection, fetcher, network } = await fixture();
    network.form = { ...form, info: { title: "a".repeat(4 * 1024 * 1024) } };
    for (let i = 0; i < 2; i += 1) {
      const read = readRydSubmissions(connection, formId);
      await vi.advanceTimersByTimeAsync(100);
      await read;
    }
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("fetches Drive metadata and media again for each authorized file read", async () => {
    const { fetchRydEvidence, connection, fetcher } = await fixture();
    for (let i = 0; i < 2; i += 1) {
      const file = fetchRydEvidence(connection, files[0]);
      await vi.advanceTimersByTimeAsync(100);
      expect(await new Response((await file).body).text()).toBe("synthetic image");
    }
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("alt=media"))).toHaveLength(2);
  });

  it("lets one request cancel while another keeps its shared read", async () => {
    const { readRydSubmissions, connection, fetcher } = await fixture();
    const controller = new AbortController();
    const cancelled = readRydSubmissions(connection, formId, { signal: controller.signal });
    const rejected = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    const survivor = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(5);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(100);
    expect((await survivor).submissions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("cancels upstream work when the last waiter leaves and allows a retry", async () => {
    const { readRydSubmissions, connection, fetcher } = await fixture();
    const controller = new AbortController();
    const read = readRydSubmissions(connection, formId, { signal: controller.signal });
    const rejected = expect(read).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(5);
    controller.abort();
    await rejected;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const retry = readRydSubmissions(connection, formId);
    await vi.advanceTimersByTimeAsync(100);
    expect((await retry).submissions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("bounds a slow paginated form read by one overall deadline", async () => {
    const { readRydSubmissions, connection, network } = await fixture();
    network.latencyMs = 9000;
    const read = readRydSubmissions(connection, formId);
    const rejected = expect(read).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(25_000);
    await rejected;
  });

  it("times out JSON bodies even after receiving successful headers", async () => {
    const { fetcher } = await fixture();
    const { googleJson } = await import("@/lib/server/google-oauth");
    fetcher.mockImplementation(async (_url, init) =>
      new Response(new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener(
            "abort", () => controller.error(init.signal?.reason), { once: true },
          );
        },
      })),
    );
    const read = googleJson("https://forms.googleapis.com/synthetic", {});
    const rejected = expect(read).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
  });

  it.each(["cancel", "timeout"])("stops a streamed file on %s", async (action) => {
    const { fetchRydEvidence, connection, fetcher } = await fixture();
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, init) => {
      if (!String(url).includes("alt=media")) return original(url, init);
      return new Response(new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener(
            "abort", () => controller.error(init.signal?.reason), { once: true },
          );
        },
      }));
    });
    const controller = new AbortController();
    const file = fetchRydEvidence(connection, files[0], controller.signal);
    await vi.advanceTimersByTimeAsync(100);
    const body = new Response((await file).body).text();
    const rejected = expect(body).rejects.toMatchObject({
      name: action === "cancel" ? "AbortError" : "TimeoutError",
    });
    if (action === "cancel") controller.abort();
    else await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
  });
});
