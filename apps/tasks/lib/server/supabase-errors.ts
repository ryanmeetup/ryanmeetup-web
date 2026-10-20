import "server-only";

/**
 * Whether a Supabase error means the table itself does not exist, as opposed to
 * a query, permission, or connectivity failure.
 *
 * `42P01` is Postgres `undefined_table`; `PGRST205` is PostgREST reporting a
 * table absent from its schema cache. Callers use this to tolerate a table that
 * a pending migration has not created yet — never to swallow other failures.
 */
export const isMissingRelation = (code?: string) =>
  code === "42P01" || code === "PGRST205";

/**
 * Whether a Supabase error means a column does not exist yet. `42703` is
 * Postgres `undefined_column`; `PGRST204` is PostgREST's schema-cache
 * equivalent. Same narrow purpose as `isMissingRelation`.
 */
export const isMissingColumn = (code?: string) =>
  code === "42703" || code === "PGRST204";

/** Told to whoever reads the log: how to make the missing table appear. */
export const APPLY_MIGRATIONS_HINT =
  "Apply the pending migrations in apps/tasks/supabase/migrations with `supabase db push`.";

/**
 * Whether a Supabase error means a `.single()` query matched no row.
 *
 * `PGRST116` is PostgREST reporting that the result did not contain exactly one
 * row. Under RLS a row the member cannot see is indistinguishable from one that
 * does not exist, and both deserve the same answer: not found. Use it only to
 * turn a missing row into a 404 — every other error must still propagate.
 */
export const isNoRowsFound = (code?: string) => code === "PGRST116";

/**
 * Whether a Supabase error is a resource mutation rejecting a value the form
 * offered — an owner who has not finished onboarding, access groups on a
 * project that is not restricted.
 *
 * `RS001` is raised only by `create_project_with_visibility`,
 * `replace_project_owners_and_update`, `create_category_with_owners`,
 * `update_category_with_owners`, `set_project_visibility`, and
 * `set_category_access`, the way `save_task` raises `TK001` for a missing
 * status reason. The message is authored by the migration and names what the
 * person has to change, so callers return it verbatim; every other code still
 * goes through `databaseFailure`, which never repeats what the database said.
 */
export const isRejectedResourceValue = (code?: string) => code === "RS001";

/**
 * Whether a Supabase error means the database function itself does not exist.
 *
 * `42883` is Postgres `undefined_function`; `PGRST202` is PostgREST reporting
 * a function absent from its schema cache. Same narrow purpose as
 * `isMissingRelation`: tolerate an RPC a pending migration has not created
 * yet. Never use it to swallow a function that exists and failed.
 */
export const isMissingFunction = (code?: string) =>
  code === "42883" || code === "PGRST202";
