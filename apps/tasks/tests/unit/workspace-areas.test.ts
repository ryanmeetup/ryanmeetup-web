import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  canViewWorkspaceArea,
  isWorkspaceAreaKey,
  workspaceAreaLabel,
  workspaceAreaRequiresAccessCheck,
  WORKSPACE_AREA_KEYS,
  guestHome,
} from "@/lib/access/workspace-areas";

describe("workspace area registry", () => {
  it("accepts only the keys the registry declares", () => {
    expect(isWorkspaceAreaKey("notes")).toBe(true);
    expect(isWorkspaceAreaKey("board")).toBe(false);
    expect(isWorkspaceAreaKey(null)).toBe(false);
  });

  it("names a page for the audit trail and the toast", () => {
    expect(workspaceAreaLabel("contacts")).toBe("Contacts");
  });

  it("treats a page missing from the list as closed", () => {
    expect(canViewWorkspaceArea(["notes"], "notes")).toBe(true);
    expect(canViewWorkspaceArea(["notes"], "contacts")).toBe(false);
    expect(canViewWorkspaceArea([], "calendar")).toBe(false);
  });

  it("opens every page where there is no server to ask", () => {
    for (const area of WORKSPACE_AREA_KEYS)
      expect(canViewWorkspaceArea(undefined, area)).toBe(true);
  });

  it("requires a real access lookup for service-role-only RY-D data", () => {
    expect(workspaceAreaRequiresAccessCheck("ryd")).toBe(true);
    expect(workspaceAreaRequiresAccessCheck("notes")).toBe(false);
  });

  it("keeps RY-D out of the server page fallback when page-access functions are absent", async () => {
    const { loadWorkspace } = await import("@/lib/server/workspace-loader");
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: { id: "member-1" }, error: null }),
    };
    const supabase = {
      from: () => query,
      rpc: async (name: string) =>
        name === "accessible_workspace_areas"
          ? { data: null, error: { code: "PGRST202" } }
          : { data: false, error: null },
    } as unknown as SupabaseClient;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const workspace = await loadWorkspace(supabase, "member-1", []);
      expect(workspace?.accessibleAreas).toEqual([
        "notes",
        "contacts",
        "calendar",
      ]);
    } finally {
      warning.mockRestore();
    }
  });
});

describe("guest landing page", () => {
  it("is the first page this instance has that the guest can open", () => {
    expect(guestHome(["ryd"], { rydEnabled: true })).toBe("/ryd");
    expect(guestHome(["calendar", "ryd"], { rydEnabled: true })).toBe(
      "/calendar",
    );
  });
  it("falls back to the profile when no granted page exists here", () => {
    expect(guestHome(["ryd"], { rydEnabled: false })).toBe("/profile");
    expect(guestHome([], { rydEnabled: true })).toBe("/profile");
  });
});
