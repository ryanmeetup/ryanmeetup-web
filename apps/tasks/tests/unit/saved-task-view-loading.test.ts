import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSavedTaskViews } from "@/lib/server/saved-task-views";

describe("personal saved view loading", () => {
  function database(result: unknown) {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn().mockResolvedValue(result),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    return { database: { from } as unknown as SupabaseClient, ...query };
  }

  it("loads only the signed-in person's views", async () => {
    const db = database({
      data: [{ id: "one", name: "Focus", settings: {} }],
      error: null,
    });
    expect(await loadSavedTaskViews(db.database, "current-user")).toMatchObject(
      { available: true, views: [{ name: "Focus" }] },
    );
    expect(db.eq).toHaveBeenCalledWith("profile_id", "current-user");
  });

  it("tolerates only an unapplied table migration", async () => {
    const missing = database({ data: null, error: { code: "PGRST205" } });
    expect(await loadSavedTaskViews(missing.database, "current-user")).toEqual({
      views: [],
      available: false,
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const denied = database({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(
      loadSavedTaskViews(denied.database, "current-user"),
    ).rejects.toThrow("Workspace data could not be loaded");
    log.mockRestore();
  });
});
