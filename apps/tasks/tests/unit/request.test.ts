import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson } from "@/lib/server/request";

const schema = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  Reflect.get(value, "name") === "Ryan"
    ? { name: "Ryan" }
    : null;

function request(body: string, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/example", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body,
  });
}

async function responseBody(result: Awaited<ReturnType<typeof readJson>>) {
  if (!("response" in result)) throw new Error("Expected readJson to fail.");
  return {
    status: result.response.status,
    body: await result.response.json(),
  };
}

describe("readJson", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a same-origin JSON request after schema validation", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await expect(
      readJson(request(JSON.stringify({ name: "Ryan" })), schema),
    ).resolves.toEqual({ data: { name: "Ryan" } });
  });

  it("rejects a request without an allowed origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TASKS_APP_URL", "https://tasks.example.com");

    const result = await readJson(
      request(JSON.stringify({ name: "Ryan" }), {
        origin: "https://attacker.example",
      }),
      schema,
    );

    await expect(responseBody(result)).resolves.toEqual({
      status: 403,
      body: {
        code: "ORIGIN_REJECTED",
        error: "This request did not come from the Tasks app.",
      },
    });
  });

  it("allows service parsing only without browser headers and keeps the default browser origin gate", async () => {
    const service = () => new Request("https://tasks.test/api/service", { method: "POST", headers: { "content-type": "application/json" }, body: '{"name":"Ryan"}' });
    await expect(readJson(service(), schema, { source: "service" })).resolves.toEqual({ data: { name: "Ryan" } });
    await expect(responseBody(await readJson(service(), schema))).resolves.toMatchObject({ status: 403 });
    await expect(responseBody(await readJson(request('{"name":"Ryan"}'), schema, { source: "service" }))).resolves.toMatchObject({ status: 403 });
    const browser = service();
    browser.headers.set("sec-fetch-site", "same-origin");
    await expect(responseBody(await readJson(browser, schema, { source: "service" }))).resolves.toMatchObject({ status: 403 });
  });

  it("rejects non-JSON media types before reading the body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = await readJson(
      request("name=Ryan", { "content-type": "text/plain" }),
      schema,
    );

    await expect(responseBody(result)).resolves.toMatchObject({
      status: 415,
      body: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("rejects an oversized declared body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = await readJson(
      request("{}", { "content-length": String(16 * 1024 + 1) }),
      schema,
    );

    await expect(responseBody(result)).resolves.toMatchObject({
      status: 413,
      body: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("measures the received UTF-8 body instead of trusting content-length", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = await readJson(
      request(JSON.stringify({ name: "é".repeat(9_000) })),
      schema,
    );

    await expect(responseBody(result)).resolves.toMatchObject({
      status: 413,
      body: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("distinguishes malformed JSON from schema-invalid JSON", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const malformed = await readJson(request("{"), schema);
    await expect(responseBody(malformed)).resolves.toMatchObject({
      status: 400,
      body: { code: "INVALID_JSON" },
    });

    const invalid = await readJson(
      request(JSON.stringify({ name: "Somebody else" })),
      schema,
    );
    await expect(responseBody(invalid)).resolves.toMatchObject({
      status: 400,
      body: { code: "INVALID_REQUEST" },
    });
  });
});
