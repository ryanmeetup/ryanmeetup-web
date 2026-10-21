import { describe, expect, it, vi } from "vitest";
// Deployment scripts run as native ESM before Next builds.
import { checkRydContract } from "../../scripts/check-ryd-contract.mjs";

function fixture(
  settings: unknown = [{ ryd_enabled: true }],
  health: unknown = { contractOk: true, failures: [] },
) {
  return vi.fn(async (path: string) =>
    Response.json(path.startsWith("instance_settings") ? settings : health),
  );
}

describe("enabled RY-D deployment contract", () => {
  it.each([
    { rows: [] },
    { rows: [{ ryd_enabled: false }] },
    { rows: [{ ryd_enabled: null }] },
  ])("does not require RY-D on a disabled instance: %j", async ({ rows }) => {
    const request = fixture(rows);
    await checkRydContract(request);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("checks an enabled instance through only the read-only health RPC", async () => {
    const request = fixture();
    await checkRydContract(request);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "instance_settings?select=ryd_enabled&limit=2",
      "rpc/ryd_contract_health",
    ]);
    expect(request).toHaveBeenLastCalledWith("rpc/ryd_contract_health", {
      method: "POST",
      body: "{}",
    });
  });
  it("leaves the feature off before the feature column exists", async () => {
    const request = vi.fn(async () =>
      Response.json({ code: "42703" }, { status: 400 }),
    );
    await checkRydContract(request);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([
    { rows: {} },
    { rows: [{ ryd_enabled: "true" }] },
    { rows: [{ other: true }] },
    { rows: [null] },
    { rows: [{ ryd_enabled: false }, { ryd_enabled: true }] },
  ])("refuses malformed settings: %j", async ({ rows }) => {
    await expect(checkRydContract(fixture(rows))).rejects.toThrow(
      "invalid result",
    );
  });
  it.each([401, 403, 404, 500])(
    "does not treat settings failure as disabled (%s)",
    async (status) => {
      await expect(
        checkRydContract(async () =>
          Response.json({ code: "different" }, { status }),
        ),
      ).rejects.toThrow("could not be read");
    },
  );
  it.each([
    null,
    {},
    { contractOk: "true", failures: [] },
    { contractOk: true },
    { contractOk: false, failures: ["Missing table: ryd_orders"] },
    { contractOk: true, failures: ["Unsafe RPC"] },
  ])("refuses unhealthy or malformed diagnostics: %j", async (health) => {
    await expect(checkRydContract(fixture(undefined, health))).rejects.toThrow(
      "contract failed",
    );
  });
  it("explains a pending health migration", async () => {
    const request = fixture()
      .mockImplementationOnce(async () =>
        Response.json([{ ryd_enabled: true }]),
      )
      .mockImplementationOnce(async () =>
        Response.json({ code: "PGRST202" }, { status: 404 }),
      );
    await expect(checkRydContract(request)).rejects.toThrow(
      "Apply it to this instance",
    );
  });
  it("propagates connection and response-body failures", async () => {
    await expect(
      checkRydContract(async () => {
        throw new Error("network failure");
      }),
    ).rejects.toThrow("network failure");
    await expect(
      checkRydContract(async () => new Response("invalid json")),
    ).rejects.toThrow();
  });
});
