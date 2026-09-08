import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (process.env.SKIP_DATABASE_CONTRACT_CHECK === "1") {
  console.log("Database contract preflight skipped explicitly.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !secret) {
  console.log(
    "Database contract preflight skipped: deployment credentials are not present.",
  );
  process.exit(0);
}

const projectRef = new URL(url).hostname.split(".")[0];

let response;
try {
  response = await fetch(`${url}/rest/v1/rpc/beginner_flow_health`, {
    method: "POST",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
} catch (error) {
  console.error(
    "Database contract preflight could not reach the configured Supabase project.",
    error instanceof Error ? error.message : "Unknown network error",
  );
  process.exit(1);
}

if (!response.ok) {
  console.error(
    `Database contract preflight failed for ${projectRef} (${response.status}). Apply and verify the linked database changes before deploying the app.`,
  );
  process.exit(1);
}

const health = await response.json();
if (!health?.contractOk) {
  console.error(
    "Database contract preflight failed: required columns, functions, or triggers are missing.",
  );
  process.exit(1);
}

async function requireRpc(name, body, expectedFailureCodes = []) {
  const rpcResponse = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (rpcResponse.ok) return;
  const failure = await rpcResponse.json().catch(() => null);
  if (expectedFailureCodes.includes(failure?.code)) return;
  console.error(
    `Database contract preflight failed: required RPC ${name} is unavailable.`,
  );
  process.exit(1);
}

const zeroId = "00000000-0000-0000-0000-000000000000";
await requireRpc("can_administer_project_access", {
  requested_project_id: zeroId,
});
await requireRpc(
  "replace_profile_access",
  {
    requested_profile_id: zeroId,
    requested_tier_id: zeroId,
    requested_team_ids: [],
    requested_app_role: "member",
  },
  ["42501"],
);
await requireRpc("set_default_access_tier", { requested_group_id: zeroId }, [
  "42501",
]);

const contactsResponse = await fetch(
  `${url}/rest/v1/contacts?select=image_path&limit=0`,
  {
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
    },
    signal: AbortSignal.timeout(15_000),
  },
);
if (!contactsResponse.ok) {
  console.error(
    "Database contract preflight failed: contacts.image_path is missing.",
  );
  process.exit(1);
}

const contactMethodsResponse = await fetch(
  `${url}/rest/v1/contact_people?select=email_methods,phone_methods&limit=0`,
  {
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
    },
    signal: AbortSignal.timeout(15_000),
  },
);
if (!contactMethodsResponse.ok) {
  console.error(
    "Database contract preflight failed: labeled contact methods are missing.",
  );
  process.exit(1);
}

const projectDatesResponse = await fetch(
  `${url}/rest/v1/projects?select=start_date,due_date&limit=0`,
  {
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
    },
    signal: AbortSignal.timeout(15_000),
  },
);
if (!projectDatesResponse.ok) {
  console.error(
    "Database contract preflight failed: project start and due dates are missing.",
  );
  process.exit(1);
}

console.log(`Database contract preflight passed for ${projectRef}.`);
