import { describe, expect, it } from "vitest";
import {
  categorySchema,
  projectCreateSchema,
  projectPatchSchema,
} from "@/lib/api-schema";
import { ensureHttpUrlScheme } from "@ryanmeetup/utils";

describe("ensureHttpUrlScheme", () => {
  it("adds HTTPS to a bare domain", () => {
    expect(ensureHttpUrlScheme("ryanmeetup.com")).toBe(
      "https://ryanmeetup.com",
    );
  });

  it("preserves an explicit HTTP or HTTPS scheme", () => {
    expect(ensureHttpUrlScheme("https://ryanmeetup.com/docs")).toBe(
      "https://ryanmeetup.com/docs",
    );
    expect(ensureHttpUrlScheme("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("normalizes protocol-relative URLs and surrounding whitespace", () => {
    expect(ensureHttpUrlScheme("  //ryanmeetup.com/docs  ")).toBe(
      "https://ryanmeetup.com/docs",
    );
  });

  it("leaves explicit unsupported schemes for validation to reject", () => {
    expect(ensureHttpUrlScheme("javascript:alert(1)")).toBe(
      "javascript:alert(1)",
    );
  });

  it("normalizes bare domains at the project API boundary", () => {
    expect(
      projectCreateSchema({
        name: "Website refresh",
        description: "Give the website a fresh coat of Ryan.",
        links: [{ label: "Website", url: "ryanmeetup.com" }],
        ownerIds: ["7b27db83-577d-4de1-b4ca-9f088832f25b"],
        accessMode: "owners",
        accessGroupIds: [],
      }),
    ).toMatchObject({
      links: [{ label: "Website", url: "https://ryanmeetup.com/" }],
    });
  });

  it("requires a selected group for restricted project visibility", () => {
    const project = {
      name: "Website refresh",
      description: "Give the website a fresh coat of Ryan.",
      links: [],
      ownerIds: ["7b27db83-577d-4de1-b4ca-9f088832f25b"],
      accessMode: "restricted",
      accessGroupIds: [],
    };
    expect(projectCreateSchema(project)).toBeNull();
    expect(
      projectCreateSchema({
        ...project,
        accessGroupIds: ["b80b9d63-3eed-40a3-9a17-1cf9be8867fe"],
      }),
    ).toMatchObject({ accessMode: "restricted" });
  });

  it("defaults new projects to discovery and validates lifecycle status", () => {
    const project = {
      name: "Website refresh",
      description: "Give the website a fresh coat of Ryan.",
      links: [],
      ownerIds: ["7b27db83-577d-4de1-b4ca-9f088832f25b"],
      accessMode: "owners",
      accessGroupIds: [],
    };
    expect(projectCreateSchema(project)).toMatchObject({
      status: "discovery",
    });
    expect(projectCreateSchema({ ...project, status: "active" })).toMatchObject(
      { status: "active" },
    );
    expect(
      projectCreateSchema({ ...project, status: "almost-done" }),
    ).toBeNull();
  });

  it("takes optional project dates and keeps them in order", () => {
    const project = {
      name: "Website refresh",
      description: "Give the website a fresh coat of Ryan.",
      links: [],
      ownerIds: ["7b27db83-577d-4de1-b4ca-9f088832f25b"],
      accessMode: "owners",
      accessGroupIds: [],
    };
    expect(projectCreateSchema(project)).toMatchObject({
      startDate: null,
      dueDate: null,
    });
    expect(
      projectCreateSchema({
        ...project,
        startDate: "2026-01-15",
        dueDate: "2026-06-30",
      }),
    ).toMatchObject({ startDate: "2026-01-15", dueDate: "2026-06-30" });
    expect(
      projectCreateSchema({ ...project, startDate: "", dueDate: null }),
    ).toMatchObject({ startDate: null, dueDate: null });
    expect(
      projectCreateSchema({
        ...project,
        startDate: "2026-06-30",
        dueDate: "2026-01-15",
      }),
    ).toBeNull();
    expect(
      projectCreateSchema({ ...project, dueDate: "2026-02-31" }),
    ).toBeNull();
    expect(
      projectCreateSchema({ ...project, dueDate: "30/06/2026" }),
    ).toBeNull();
  });

  it("leaves project dates alone when a patch does not send them", () => {
    const id = "7b27db83-577d-4de1-b4ca-9f088832f25b";
    expect(projectPatchSchema({ id, name: "Renamed" })).toMatchObject({
      startDate: undefined,
      dueDate: undefined,
    });
    expect(projectPatchSchema({ id, dueDate: null })).toMatchObject({
      dueDate: null,
    });
    expect(
      projectPatchSchema({
        id,
        startDate: "2026-06-30",
        dueDate: "2026-01-15",
      }),
    ).toBeNull();
  });

  it("normalizes and validates category links through the same API boundary", () => {
    const ownerId = "7b27db83-577d-4de1-b4ca-9f088832f25b";
    expect(
      categorySchema({
        name: "Meetups",
        description: "Local meetup work.",
        color: "#0f766e",
        links: [{ label: "Runbook", url: "example.com/runbook" }],
        ownerIds: [ownerId],
      }),
    ).toMatchObject({
      links: [{ label: "Runbook", url: "https://example.com/runbook" }],
    });
    expect(
      categorySchema({
        name: "Meetups",
        description: "Local meetup work.",
        color: "#0f766e",
        links: [{ label: "Unsafe", url: "javascript:alert(1)" }],
        ownerIds: [ownerId],
      }),
    ).toBeNull();
  });

  it("requires at least one owner when creating or assigning category owners", () => {
    const category = {
      name: "Meetups",
      description: "Local meetup work.",
      color: "#0f766e",
      links: [],
    };
    expect(categorySchema(category)).toBeNull();
    expect(categorySchema({ ...category, ownerIds: [] })).toBeNull();
  });

  it("requires a description and owner when editing project details", () => {
    const id = "7b27db83-577d-4de1-b4ca-9f088832f25b";
    expect(
      projectPatchSchema({
        id,
        name: "Website refresh",
        description: "",
        links: [],
        ownerIds: [id],
      }),
    ).toBeNull();
    expect(
      projectPatchSchema({
        id,
        name: "Website refresh",
        description: "A proper project description.",
        links: [],
        ownerIds: [],
      }),
    ).toBeNull();
  });

  it("still allows archive-only project updates", () => {
    expect(
      projectPatchSchema({
        id: "7b27db83-577d-4de1-b4ca-9f088832f25b",
        archived: true,
      }),
    ).toMatchObject({ archived: true });
  });

  it("allows project details to change without resubmitting owners", () => {
    expect(
      projectPatchSchema({
        id: "7b27db83-577d-4de1-b4ca-9f088832f25b",
        name: "Website refresh, again",
        description: "A proper project description.",
        links: [],
      }),
    ).toMatchObject({
      name: "Website refresh, again",
      ownerIds: undefined,
    });
  });

  it("validates project status updates", () => {
    const id = "7b27db83-577d-4de1-b4ca-9f088832f25b";
    expect(projectPatchSchema({ id, status: "paused" })).toMatchObject({
      status: "paused",
    });
    expect(projectPatchSchema({ id, status: "stuck" })).toBeNull();
  });
});
