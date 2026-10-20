# Read-only MCP access

The Ryan Meetup Tasks MCP integration lets Claude Desktop read workspace data
for planning and pattern analysis. It has no create, update, delete, upload, or
other business-data mutation operation.

## Architecture

Claude Desktop runs the local `@ryanmeetup/tasks-mcp` MCP server over stdio.
That process sends authenticated HTTPS queries to
`https://tasks.ryanmeetup.com/api/mcp/v1/query`. The API validates a dedicated
read token before it creates the server-only Supabase client.

The raw token is never stored in Vercel. RMT stores only its SHA-256 digest,
while Claude Desktop stores the raw value as sensitive extension
configuration. The Supabase secret key never leaves the RMT deployment.

The shared code also deploys to PRD, but PRD must not define either MCP
environment variable. An unconfigured instance returns `503` before touching
the database.

## Data boundary

The API exposes database-backed workspace content:

- tasks, status, project, category, label, assignee, reporter, and creator data;
- task descriptions, comments, replies, checklist items, activity, and
  attachment metadata;
- notes, note comments, conversion links, and archive state;
- projects and categories with owners, access grants, tasks, links, and
  database-backed attachment note bodies;
- calendar events and recurrence data stored by Tasks;
- contacts, people, contact categories, contact details, and organization
  notes;
- profiles, workspace catalogs, digest settings, digest run history, access
  groups, and audit events; and
- deterministic work metrics derived from task records; and
- RY-D sales, when RY-D Verification is on: every fulfillment order (including
  those already sent back as verified), its decision and reviewer note, and the
  RY-dentification form answers and social links of the submission linked to
  it, plus a summary of buyers by name spelling, where Ryan falls in the
  form's name (first, middle, or last), email type, gifts, month, and form
  answer.

It deliberately excludes encrypted integration tokens, environment secrets,
MCP token hashes, rate-limit internals, raw Supabase auth records, and binary
attachment contents. RY-D buyers' email addresses are reduced to their domain,
and files uploaded through the RY-dentification form are never returned.
Form answers are read live from Google on each call, as `/ryd` reads them; if
the form can't be read, the order data still comes back with a warning.
Imported Google Calendar event payloads are fetched live
by the application and are not part of the Tasks database, so they are not in
this integration.

Contact and governance tools return sensitive data. Enable only this trusted
private extension, and use those tools only when the conversation needs them.
Any record a tool returns is sent to Claude for processing.

## Configure RMT

Generate a dedicated token. Keep the raw first line private and calculate its
digest locally:

```sh
openssl rand -hex 32
printf '%s' 'PASTE_THE_RAW_TOKEN_HERE' | shasum -a 256
```

Set these environment variables on the **RMT Vercel project only**:

```text
TASKS_MCP_READ_ENABLED=true
TASKS_MCP_READ_TOKEN_SHA256=<64-character SHA-256 hex digest>
```

This is a separate, workspace-wide read authority—not a user account. It uses
the service client and therefore does not inherit any person's tier, team,
project, category, or page restrictions. App owners can see whether it is
enabled, plus a masked token-hash fingerprint, on the Admin overview. Treat a
configured token like an app-owner credential and rotate it when its operator
changes.

Do not add them to PRD. Trigger a fresh RMT deployment after changing the
environment, then verify the health endpoint with the raw token:

```sh
curl -H 'Authorization: Bearer PASTE_THE_RAW_TOKEN_HERE' \
  https://tasks.ryanmeetup.com/api/mcp/v1
```

The response must include `"readOnly":true`. A missing or incorrect token must
return `401`; an instance where MCP is not configured must return `503`.

To rotate access, generate a new raw token, replace the RMT digest, deploy
fresh, and replace the extension's saved token. The old token stops working as
soon as the new deployment is live.

## Build and install the Claude Desktop bundle

From the repository root:

```sh
npm run pack:mcpb --workspace=@ryanmeetup/tasks-mcp
```

The command validates and packages the bundle in `apps/tasks-mcp`. In Claude
Desktop, open **Settings → Extensions → Advanced settings → Install
Extension…**, choose the generated `.mcpb` file, keep the production API URL,
and paste the raw read token into the sensitive token field.

Useful first prompts:

- “Start with the workspace overview, then summarize the last six months of
  work by project and category.”
- “Which completed tasks took longest, and what themes do their comments and
  activity share?”
- “Identify recurring work that should become a checklist or scheduled
  process.”
- “Compare created and completed work, then propose a realistic plan for next
  month.”
- “What types of Ryans are buying RY-Ds? Break it down by spelling, email type,
  gifts, and how they heard about us.”

After adding a tool, rebuild the bundle and install it again in Claude
Desktop; the installed extension only knows the tools it was packed with.

## Local development

The MCP server refuses every non-RMT remote origin. Explicit local development
is the only exception:

```text
RMT_MCP_API_URL=http://127.0.0.1:3000
RMT_MCP_ALLOW_LOCALHOST=true
RMT_MCP_READ_TOKEN=<raw development token>
```

Configure the matching digest in `apps/tasks/.env.local`. Never use the RMT
production token for local development and never point a local MCP server at
PRD.

## Validation

```sh
npm run typecheck --workspace=@ryanmeetup/tasks
npm test --workspace=@ryanmeetup/tasks
npm run build --workspace=@ryanmeetup/tasks
npm run typecheck --workspace=@ryanmeetup/tasks-mcp
npm test --workspace=@ryanmeetup/tasks-mcp
npm run build --workspace=@ryanmeetup/tasks-mcp
npm exec --workspace=@ryanmeetup/tasks-mcp mcpb -- validate manifest.json
```

The MCP API uses the existing database schema and requires no migration.
