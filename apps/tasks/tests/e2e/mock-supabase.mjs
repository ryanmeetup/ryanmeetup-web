import { createServer } from "node:http";

const port = Number(process.env.PLAYWRIGHT_SUPABASE_PORT ?? 54329);

const json = (response, status, body) => {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "*",
  });
  response.end(JSON.stringify(body));
};

/**
 * The one member this double knows about, already onboarded, so a spec that
 * signs in reaches the workspace rather than the onboarding gate.
 */
const MEMBER_ID = "11111111-1111-1111-1111-111111111111";
const MOCK_MEMBER = {
  email: "member@example.com",
  password: "correct-horse-battery",
};

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * Shaped like a JWT rather than being one: the app never verifies a signature
 * itself, and the double answers `/auth/v1/user` for any token that carries
 * one, so the publishable key an anonymous caller sends still reads as signed
 * out.
 */
const accessToken = () => {
  const now = Math.floor(Date.now() / 1000);
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({
      sub: MEMBER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: MOCK_MEMBER.email,
      iat: now,
      exp: now + 3600,
    }),
    "signature",
  ].join(".");
};

const user = () => ({
  id: MEMBER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: MOCK_MEMBER.email,
  email_confirmed_at: new Date(0).toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test Member" },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date().toISOString(),
});

const session = () => ({
  access_token: accessToken(),
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: user(),
});

const profile = {
  id: MEMBER_ID,
  full_name: "Test Member",
  avatar_url: null,
  onboarding_completed: true,
  task_details_open_by_default: true,
  assign_new_tasks_to_self: false,
  editor_surface: "auto",
  calendar_default_view: ["task", "away", "important", "google"],
  favorite_project_ids: [],
  app_role: "owner",
};

/**
 * Every collection the workspace loads, empty apart from the member itself.
 * The specs that assert on content enter through demo mode and its fixtures;
 * what a signed-in spec needs from here is a workspace that renders at all.
 */
const tables = {
  profiles: [profile],
  statuses: [],
  work_groups: [],
  projects: [],
  project_owners: [],
  category_owners: [],
  tasks: [],
  subtasks: [],
  task_comments: [],
  task_activity: [],
  task_attachments: [],
  labels: [],
  task_assignees: [],
  task_labels: [],
  task_categories: [],
};

const readBody = (request) =>
  new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const signedIn = (request.headers.authorization ?? "").includes(".");
  // PostgREST returns a bare object rather than an array for `.maybeSingle()`.
  const single = (request.headers.accept ?? "").includes("pgrst.object");

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    json(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/rest/v1/instance_settings") {
    json(response, 200, {});
    return;
  }

  /**
   * Demo preview asks the database whether the caller owns the app, and the
   * workspace specs ride that flag to reach the shell without a session. The
   * double answers yes because nothing else in the suite depends on ownership;
   * the real gate lives in Postgres, where a forged cookie gets nowhere.
   */
  if (url.pathname === "/rest/v1/rpc/is_app_owner") {
    json(response, 200, true);
    return;
  }

  if (url.pathname === "/rest/v1/rpc/can_manage_categories") {
    json(response, 200, true);
    return;
  }

  /** Page access is enforced in Postgres; the double locks nothing. */
  if (url.pathname === "/rest/v1/rpc/accessible_workspace_areas") {
    const payload = await readBody(request);
    json(response, 200, payload.requested_areas ?? []);
    return;
  }

  /** Any credentials are accepted: the specs test the app, not GoTrue. */
  if (url.pathname === "/auth/v1/token") {
    json(response, 200, session());
    return;
  }

  if (url.pathname === "/auth/v1/user") {
    if (!signedIn) {
      json(response, 401, { message: "Auth session missing" });
      return;
    }
    json(response, 200, user());
    return;
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const rows = signedIn
      ? (tables[url.pathname.slice("/rest/v1/".length)] ?? [])
      : [];
    if (!single) {
      json(response, 200, rows);
      return;
    }
    if (rows.length) {
      json(response, 200, rows[0]);
      return;
    }
    json(response, 406, {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
    });
    return;
  }

  json(response, 404, { message: "Not found" });
});

server.listen(port, "127.0.0.1");

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);
