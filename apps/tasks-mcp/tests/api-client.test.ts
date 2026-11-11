import { afterEach, describe, expect, it, vi } from "vitest";
import {
  callRmtReadApi,
  readToken,
  resolveApiOrigin,
} from "../src/api-client.js";

describe("RMT read API client", () => {
  afterEach(() => {
    delete process.env.RMT_MCP_ALLOW_LOCALHOST;
  });

  it("allows only the production RMT origin by default", () => {
    expect(resolveApiOrigin()).toBe("https://tasks.ryanmeetup.com");
    expect(() => resolveApiOrigin("https://projects.ryanle.dev")).toThrow(
      /must be https:\/\/tasks\.ryanmeetup\.com/,
    );
    expect(() => resolveApiOrigin("https://evil.example")).toThrow();
  });

  it("allows localhost only when explicit development mode is enabled", () => {
    expect(() => resolveApiOrigin("http://127.0.0.1:3000")).toThrow();
    expect(resolveApiOrigin("http://127.0.0.1:3000", true)).toBe(
      "http://127.0.0.1:3000",
    );
  });

  it("requires a dedicated token of meaningful length", () => {
    expect(() => readToken("short")).toThrow(/too short/);
    expect(readToken("x".repeat(32))).toBe("x".repeat(32));
  });

  it("sends only a bearer-authenticated read action", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          action: "list_tasks",
          generatedAt: "2026-08-31T00:00:00.000Z",
          data: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await callRmtReadApi(
      "list_tasks",
      { limit: 10 },
      {
        fetch: request,
        apiOrigin: "https://tasks.ryanmeetup.com",
        token: "t".repeat(32),
      },
    );
    expect(result.action).toBe("list_tasks");
    expect(request).toHaveBeenCalledWith(
      "https://tasks.ryanmeetup.com/api/mcp/v1/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${"t".repeat(32)}` }),
        body: JSON.stringify({ action: "list_tasks", params: { limit: 10 } }),
      }),
    );
  });

  it("surfaces safe API errors", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "A valid MCP read token is required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      callRmtReadApi("get_workspace_overview", {}, {
        fetch: request,
        token: "t".repeat(32),
      }),
    ).rejects.toThrow(/valid MCP read token/);
  });

  it("preserves the cause when the request fails", async () => {
    const cause = new Error("Connection closed");
    const request = vi.fn().mockRejectedValue(cause);

    await expect(
      callRmtReadApi("list_tasks", {}, {
        fetch: request,
        token: "t".repeat(32),
      }),
    ).rejects.toMatchObject({
      message: "RMT Tasks could not be reached: Connection closed",
      cause,
    });
  });
});
