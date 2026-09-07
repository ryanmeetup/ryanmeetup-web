import "server-only";

import { getAdminClient } from "@/lib/server/admin-client";
import { readBeginnerFlowHealth } from "@/lib/server/beginner-flow-health";
import { instanceBuild } from "@/lib/instance";

export type IntegrationState =
  "connected" | "configured" | "disabled" | "attention" | "missing";

/** Which glyph a fact carries. Mapped to an icon in the client component. */
export type FactKind =
  "host" | "secret" | "client" | "email" | "schedule" | "accounts" | "origin";

/**
 * One labelled line inside an integration: what the setting is, what it
 * currently holds, and where it comes from.
 */
export type IntegrationFact = {
  kind: FactKind;
  /** What this line is, in plain words: "API key", "Sends as", "Schedule". */
  label: string;
  /** Masked or non-secret value. Null when the underlying setting is absent. */
  value: string | null;
  /** Where the value comes from: an env var name, or a config file. */
  source: string;
  /** Machine data, rendered monospace. False for prose like "1 account". */
  mono?: boolean;
};

/**
 * One action in a setup procedure. Steps are ordered and cumulative: each one
 * assumes the ones above it are done.
 */
export type SetupStep = {
  /** The action, in the imperative. */
  text: string;
  /** A command or literal value the step needs, rendered copyable. */
  command?: string;
  /** Where the step happens, when that is somewhere outside this app. */
  link?: { href: string; label: string };
};

/** An environment variable the procedure ends by setting. */
export type SetupVariable = {
  name: string;
  /** The shape of the value, never a real one. */
  example: string;
  note?: string;
};

/**
 * Everything an operator needs to take one integration from unset to working,
 * assembled server-side so the steps can name this deployment's own origin
 * rather than a placeholder.
 */
export type IntegrationSetup = {
  /** One line on what the whole procedure buys. */
  summary: string;
  steps: SetupStep[];
  variables: SetupVariable[];
  /** The long version in the repo, for whoever wants the whole story. */
  doc?: string;
};

export type IntegrationCheck = {
  key: string;
  label: string;
  state: IntegrationState;
  /** One line on what the integration does, for anyone who has not met it. */
  blurb: string;
  /** What breaks while the check is failing. Only set when it is. */
  consequence: string | null;
  facts: IntegrationFact[];
  action?: { endpoint: string; label: string };
  /** How to fix it. Present only while the integration needs fixing. */
  setup?: IntegrationSetup;
};

/**
 * Last four characters only. Enough to tell two keys apart when rotating,
 * never enough to use one. Full secret values are never sent to the browser.
 */
function fingerprint(value: string) {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

const present = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

function hostOf(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/** States with something left to do, and therefore instructions to show. */
const needsSetup = (state: IntegrationState) =>
  state === "missing" || state === "attention" || state === "disabled";

/**
 * The procedure behind each integration, written for someone doing it for the
 * first time. These mirror the repo's own docs; the doc is linked from each
 * guide for the reasoning the steps leave out.
 *
 * `origin` is this deployment's canonical URL, so redirect URIs and curl
 * checks read as something to copy rather than a template to fill in.
 */
function setupGuides(origin: string): Record<string, IntegrationSetup> {
  return {
    "workspace-foundation": {
      summary:
        "Rebuilds the profile, access, and status rows the workspace expects, in place.",
      steps: [
        {
          text: "Run Repair workspace foundation below. It creates the rows existing members are missing, and seeds the starter statuses.",
        },
        {
          text: "If Schema contract reads Incomplete, the database is behind the repo. Push the migrations from the repo root, then repair again.",
          command: "supabase db push",
        },
        {
          text: "Reload this page. Every count should read 0 missing and the contract should read Current.",
        },
      ],
      variables: [],
      doc: "apps/tasks/docs/DATABASE.md",
    },
    supabase: {
      summary:
        "Points this deployment at its own Supabase project — never another instance's.",
      steps: [
        {
          text: "Create a Supabase project for this instance and record the database password. Each instance needs its own: borrowing a working instance's credentials silently serves the other workspace's data.",
          link: {
            href: "https://supabase.com/dashboard",
            label: "Supabase dashboard",
          },
        },
        {
          text: "Link the CLI to the new project and push the schema from the repo root.",
          command:
            "supabase link --project-ref <new-project-ref>\nsupabase db push",
        },
        {
          text: `In Auth → URL Configuration, set the Site URL to ${origin} and add its callback as a redirect URL.`,
          command: `${origin}/auth/callback`,
        },
        {
          text: "Copy the Project URL and the publishable key from Settings → API into the variables below.",
        },
        {
          text: "Redeploy. NEXT_PUBLIC_ values are inlined at build time, so an existing deployment keeps the old ones until a fresh build.",
        },
      ],
      variables: [
        {
          name: "NEXT_PUBLIC_SUPABASE_URL",
          example: "https://your-project.supabase.co",
        },
        {
          name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          example: "sb_publishable_your-key",
        },
      ],
      doc: "apps/tasks/docs/MULTI_INSTANCE.md",
    },
    "supabase-secret": {
      summary: "The server-only key privileged writes are signed with.",
      steps: [
        {
          text: "Open the same Supabase project's Settings → API and reveal the secret key.",
          link: {
            href: "https://supabase.com/dashboard",
            label: "Supabase dashboard",
          },
        },
        {
          text: "Set it as a server-only variable. Never prefix it with NEXT_PUBLIC_ — that would ship it to every browser.",
        },
        { text: "Redeploy." },
      ],
      variables: [
        {
          name: "SUPABASE_SECRET_KEY",
          example: "sb_secret_your-server-only-key",
          note: "SUPABASE_SERVICE_ROLE_KEY is accepted as a legacy alias.",
        },
      ],
      doc: "apps/tasks/docs/MULTI_INSTANCE.md",
    },
    "mcp-read": {
      summary:
        "A workspace-wide read token for the Claude Desktop extension. Leave it off unless you run that extension: it reads all workspace data and inherits nobody's restrictions.",
      steps: [
        {
          text: "Generate a raw token and its digest locally. Keep the first line private; only the digest leaves your machine.",
          command:
            "openssl rand -hex 32\nprintf '%s' 'PASTE_THE_RAW_TOKEN_HERE' | shasum -a 256",
        },
        {
          text: "Set both variables below, storing the 64-character digest rather than the raw token.",
        },
        {
          text: 'Redeploy, then verify with the raw token. The response must include "readOnly":true.',
          command: `curl -H 'Authorization: Bearer PASTE_THE_RAW_TOKEN_HERE' \\\n  ${origin}/api/mcp/v1`,
        },
        {
          text: "Build the desktop bundle from the repo root, install it in Claude Desktop under Settings → Extensions, and paste the raw token into its token field.",
          command: "npm run pack:mcpb --workspace=@ryanmeetup/tasks-mcp",
        },
      ],
      variables: [
        { name: "TASKS_MCP_READ_ENABLED", example: "true" },
        {
          name: "TASKS_MCP_READ_TOKEN_SHA256",
          example: "<64-character SHA-256 hex digest>",
          note: "The digest only. The raw token belongs in Claude Desktop.",
        },
      ],
      doc: "apps/tasks/docs/MCP.md",
    },
    resend: {
      summary:
        "A Resend account, a verified sending domain, and an API key of this instance's own.",
      steps: [
        {
          text: "Create a Resend account and add the domain you will send from.",
          link: { href: "https://resend.com/domains", label: "Resend domains" },
        },
        {
          text: "Publish the DNS records Resend lists and wait for the domain to verify. Mail from an unverified domain is rejected.",
        },
        {
          text: "Create an API key with send permission. Give each instance its own — a shared key double-counts quota on the usage page.",
          link: {
            href: "https://resend.com/api-keys",
            label: "Resend API keys",
          },
        },
        {
          text: "Set both variables below, using an address at the verified domain.",
        },
        {
          text: "Redeploy, then check the digest ledger on /admin/usage after the next send window.",
        },
      ],
      variables: [
        { name: "RESEND_API_KEY", example: "re_your-key" },
        {
          name: "TASK_DIGEST_FROM_EMAIL",
          example: "Workspace Tasks <tasks@your-verified-domain.com>",
          note: "TASK_REMINDER_FROM_EMAIL and RESEND_FROM_EMAIL are accepted fallbacks.",
        },
      ],
      doc: "apps/tasks/docs/TASK_EMAILS.md",
    },
    "google-calendar": {
      summary:
        "A Google Cloud OAuth client, plus a key that encrypts the refresh tokens it hands back.",
      steps: [
        {
          text: "Create or pick a Google Cloud project and enable the Google Calendar API.",
          link: {
            href: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
            label: "Enable the Calendar API",
          },
        },
        {
          text: "Configure the OAuth consent screen with three scopes.",
          command:
            "openid\nemail\nhttps://www.googleapis.com/auth/calendar.events.owned",
        },
        {
          text: "Create an OAuth client of type Web application and add this exact authorized redirect URI.",
          command: `${origin}/api/integrations/google-calendar/callback`,
          link: {
            href: "https://console.cloud.google.com/apis/credentials",
            label: "Google credentials",
          },
        },
        {
          text: "Generate a token encryption key for this instance. Make a fresh one rather than copying another instance's — it decrypts stored refresh tokens, and changing it later invalidates every existing connection.",
          command: "openssl rand -base64 32",
        },
        { text: "Set the variables below and redeploy." },
        {
          text: "Sign in as an owner, open Calendar, choose Connect workspace calendar, and approve the Google account that owns it.",
        },
        {
          text: "In Access, enable View the workspace Google Calendar for each group that should see the events.",
        },
      ],
      variables: [
        {
          name: "GOOGLE_CALENDAR_CLIENT_ID",
          example: "your-client-id.apps.googleusercontent.com",
        },
        {
          name: "GOOGLE_CALENDAR_CLIENT_SECRET",
          example: "your-client-secret",
        },
        {
          name: "GOOGLE_CALENDAR_TOKEN_KEY",
          example: "your-base64-encoded-32-byte-key",
        },
        {
          name: "GOOGLE_CALENDAR_ID",
          example: "team@your-domain.com",
          note: "Optional. Omit it to sync the connected account's primary calendar.",
        },
      ],
      doc: "apps/tasks/docs/GOOGLE_CALENDAR.md",
    },
    cron: {
      summary:
        "One shared secret, sent by the scheduler on every run and checked by every cron route.",
      steps: [
        {
          text: "Generate a secret for this instance.",
          command: "openssl rand -base64 32",
        },
        {
          text: "Set CRON_SECRET on the deployment and redeploy. The schedules in apps/tasks/vercel.mjs are picked up per project — there is nothing else to register.",
        },
        {
          text: "Confirm Vercel Authentication is not protecting generated deployment URLs. Crons call the *.vercel.app host, and a protected one is intercepted before the route runs, with no in-app symptom. It is under Settings → Deployment Protection.",
        },
        {
          text: "After the next window, confirm a run appears in the digest ledger on /admin/usage.",
        },
      ],
      variables: [
        {
          name: "CRON_SECRET",
          example: "<32 random bytes, base64>",
          note: "Fresh per instance; never shared between deployments.",
        },
      ],
      doc: "apps/tasks/docs/TASK_EMAILS.md",
    },
    "app-url": {
      summary: "The origin every link in an outgoing email is built from.",
      steps: [
        {
          text: "Attach the production domain to the Vercel project under Settings → Domains and point DNS at it.",
        },
        {
          text: "Set both variables below to that origin, with no trailing slash.",
        },
        {
          text: "Redeploy. The NEXT_PUBLIC_ copy is inlined at build time, so emails keep the old origin until a fresh build.",
        },
      ],
      variables: [
        { name: "TASKS_APP_URL", example: "https://tasks.example.com" },
        {
          name: "NEXT_PUBLIC_TASKS_APP_URL",
          example: "https://tasks.example.com",
          note: "The same value; the browser reads this one.",
        },
      ],
      doc: "apps/tasks/docs/MULTI_INSTANCE.md",
    },
  };
}

/**
 * Read-only view of the deployment's credentials and integrations.
 *
 * Secrets are reported as present or absent with a masked fingerprint. They are
 * deliberately not editable here: they live in the hosting environment, a
 * change requires a redeploy either way, and storing them in the database to
 * render into a form would turn one compromised owner session into full
 * credential disclosure.
 */
export async function getIntegrationHealth(): Promise<IntegrationCheck[]> {
  const admin = getAdminClient();
  const beginnerFlowHealth = admin ? await readBeginnerFlowHealth(admin) : null;
  const supabaseUrl = present("NEXT_PUBLIC_SUPABASE_URL");
  const resendKey = present("RESEND_API_KEY");
  const googleId = present("GOOGLE_CALENDAR_CLIENT_ID");
  const googleSecret = present("GOOGLE_CALENDAR_CLIENT_SECRET");
  const googleTokenKey = present("GOOGLE_CALENDAR_TOKEN_KEY");
  const cronSecret = present("CRON_SECRET");
  const supabaseKey = present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const supabaseSecret = present("SUPABASE_SECRET_KEY");
  const mcpEnabled = present("TASKS_MCP_READ_ENABLED") === "true";
  const mcpTokenHash = present("TASKS_MCP_READ_TOKEN_SHA256");
  const mcpConfigured =
    mcpEnabled && Boolean(mcpTokenHash && /^[a-f0-9]{64}$/i.test(mcpTokenHash));
  const appUrl = present("TASKS_APP_URL");
  // Any of three names may supply the from-address; report the one in use so
  // the row points at the variable an operator would actually edit.
  const fromEmailVar =
    [
      "TASK_DIGEST_FROM_EMAIL",
      "TASK_REMINDER_FROM_EMAIL",
      "RESEND_FROM_EMAIL",
    ].find((name) => present(name)) ?? "TASK_DIGEST_FROM_EMAIL";
  const fromEmail = present(fromEmailVar);

  let googleConnections: number | null = null;
  if (googleId && googleSecret && googleTokenKey) {
    if (admin) {
      const { count, error } = await admin
        .from("workspace_google_calendar_integrations")
        .select("id", { count: "exact", head: true });
      googleConnections = error ? null : (count ?? 0);
    }
  }

  const checks: IntegrationCheck[] = [
    {
      key: "workspace-foundation",
      label: "Workspace foundation",
      state: beginnerFlowHealth?.healthy ? "connected" : "attention",
      blurb:
        "Creates each member's profile, baseline access, and starter statuses.",
      consequence: beginnerFlowHealth?.healthy
        ? null
        : beginnerFlowHealth
          ? "One or more members or required database objects need repair."
          : "Provisioning health could not be read from the database.",
      facts: [
        {
          kind: "accounts",
          label: "Profiles",
          value: beginnerFlowHealth
            ? String(beginnerFlowHealth.profileCount)
            : null,
          source: "profiles",
        },
        {
          kind: "accounts",
          label: "Missing profiles",
          value: beginnerFlowHealth
            ? String(beginnerFlowHealth.authUsersWithoutProfile)
            : null,
          source: "auth.users",
        },
        {
          kind: "accounts",
          label: "Missing access",
          value: beginnerFlowHealth
            ? String(beginnerFlowHealth.profilesWithoutTier)
            : null,
          source: "access_group_members",
        },
        {
          kind: "schedule",
          label: "Starter statuses",
          value: beginnerFlowHealth
            ? String(beginnerFlowHealth.statusCount)
            : null,
          source: "statuses",
        },
        {
          kind: "secret",
          label: "Schema contract",
          value: beginnerFlowHealth
            ? beginnerFlowHealth.contractOk
              ? "Current"
              : "Incomplete"
            : null,
          source: "beginner_flow_health()",
          mono: false,
        },
      ],
      action: beginnerFlowHealth?.healthy
        ? undefined
        : {
            endpoint: "/api/admin/workspace-health",
            label: "Repair workspace foundation",
          },
    },
    {
      key: "supabase",
      label: "Supabase",
      state: supabaseUrl && supabaseKey ? "connected" : "missing",
      blurb: "The Postgres database and the auth session behind every page.",
      consequence:
        supabaseUrl && supabaseKey
          ? null
          : "Running in demo mode with local fixture data.",
      facts: [
        {
          kind: "host",
          label: "Project",
          value: supabaseUrl ? (hostOf(supabaseUrl) ?? supabaseUrl) : null,
          source: "NEXT_PUBLIC_SUPABASE_URL",
        },
        {
          kind: "client",
          label: "Browser key",
          value: supabaseKey ? fingerprint(supabaseKey) : null,
          source: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        },
      ],
    },
    {
      key: "supabase-secret",
      label: "Supabase service role",
      state: supabaseSecret ? "configured" : "missing",
      blurb:
        "Signs privileged server-side writes that bypass row-level security.",
      consequence: supabaseSecret
        ? null
        : "Privileged writes are unavailable without it.",
      facts: [
        {
          kind: "secret",
          label: "Service key",
          value: supabaseSecret ? fingerprint(supabaseSecret) : null,
          source: "SUPABASE_SECRET_KEY",
        },
      ],
    },
    {
      key: "mcp-read",
      label: "External MCP read access",
      state: mcpConfigured
        ? "configured"
        : mcpEnabled
          ? "attention"
          : "disabled",
      blurb:
        "A privileged external reader for automation. It can query all workspace data and does not inherit a person's group or page restrictions.",
      consequence:
        mcpEnabled && !mcpConfigured
          ? "External read access is enabled, but its token hash is missing or invalid."
          : null,
      facts: [
        {
          kind: "client",
          label: "External reader",
          value: mcpEnabled ? "Enabled" : "Disabled",
          source: "TASKS_MCP_READ_ENABLED",
          mono: false,
        },
        {
          kind: "secret",
          label: "Bearer token hash",
          value: mcpTokenHash ? fingerprint(mcpTokenHash) : null,
          source: "TASKS_MCP_READ_TOKEN_SHA256",
        },
      ],
    },
    {
      key: "resend",
      label: "Resend",
      state: resendKey && fromEmail ? "configured" : "missing",
      blurb: "Delivers task digests, reminders, and invitations.",
      consequence:
        resendKey && fromEmail
          ? null
          : "Task digests and reminders will not send.",
      facts: [
        {
          kind: "secret",
          label: "API key",
          value: resendKey ? fingerprint(resendKey) : null,
          source: "RESEND_API_KEY",
        },
        {
          kind: "email",
          label: "Sends as",
          value: fromEmail,
          source: fromEmailVar,
        },
      ],
    },
    {
      key: "google-calendar",
      label: "Google Calendar",
      state:
        googleId && googleSecret && googleTokenKey
          ? googleConnections
            ? "connected"
            : "configured"
          : "missing",
      blurb: "Syncs tasks with the calendars workspace members link.",
      consequence:
        googleId && googleSecret && googleTokenKey
          ? null
          : "Calendar sync is unavailable.",
      facts: [
        {
          kind: "client",
          label: "OAuth client",
          value: googleId ? fingerprint(googleId) : null,
          source: "GOOGLE_CALENDAR_CLIENT_ID",
        },
        {
          kind: "secret",
          label: "OAuth secret",
          value: googleSecret ? fingerprint(googleSecret) : null,
          source: "GOOGLE_CALENDAR_CLIENT_SECRET",
        },
        {
          kind: "secret",
          label: "Token encryption",
          value: googleTokenKey ? fingerprint(googleTokenKey) : null,
          source: "GOOGLE_CALENDAR_TOKEN_KEY",
        },
        {
          kind: "accounts",
          label: "Linked",
          value:
            googleConnections === null
              ? "Count unavailable"
              : `${googleConnections} account${googleConnections === 1 ? "" : "s"}`,
          source: "workspace_google_calendar_integrations",
          mono: false,
        },
      ],
    },
    {
      key: "cron",
      label: "Scheduled jobs",
      state: cronSecret ? "configured" : "missing",
      blurb: "The shared secret every cron route checks before it runs.",
      consequence: cronSecret ? null : "Cron routes will reject every request.",
      facts: [
        {
          kind: "secret",
          label: "Shared secret",
          value: cronSecret ? fingerprint(cronSecret) : null,
          source: "CRON_SECRET",
        },
        {
          kind: "schedule",
          label: "Task digests",
          value: "Weekdays, 13:00 UTC",
          source: "vercel.json",
          mono: false,
        },
        {
          kind: "schedule",
          label: "Attachment sweep",
          value: "Daily, 03:17 UTC",
          source: "vercel.json",
          mono: false,
        },
      ],
    },
    {
      key: "app-url",
      label: "Canonical origin",
      state: appUrl ? "configured" : "missing",
      blurb: "The base URL every link in an outgoing email is built from.",
      consequence: appUrl
        ? null
        : "Email links fall back to the request origin.",
      facts: [
        {
          kind: "origin",
          label: "Origin",
          value: appUrl,
          source: "TASKS_APP_URL",
        },
      ],
    },
  ];

  // Instructions ride along only where there is something to do, so a healthy
  // deployment sends nothing extra to the browser.
  const guides = setupGuides(appUrl ?? "https://tasks.example.com");
  return checks.map((check) =>
    needsSetup(check.state) && guides[check.key]
      ? { ...check, setup: guides[check.key] }
      : check,
  );
}

/** Build-time identity, shown read-only beside the editable branding. */
export function buildTimeIdentity() {
  return [
    {
      label: "Task key prefix",
      value: `${instanceBuild.taskKeyPrefix}-142`,
      variable: "NEXT_PUBLIC_TASK_KEY_PREFIX",
      note: "Appears in every task URL. Changing it breaks existing links.",
    },
    {
      label: "Changelog version",
      value: `${instanceBuild.changelogVersionPrefix} v5`,
      variable: "NEXT_PUBLIC_CHANGELOG_VERSION_PREFIX",
      note: "Defaults to the task key prefix.",
    },
  ];
}
