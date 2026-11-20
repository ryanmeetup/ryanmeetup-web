# Superseded: PRD store customer auth SQL

**Do not run the previous SQL block on PRD.** Migration `20261120130000`
is now explicitly RMT-only in `supabase/migration-scopes.json`. PRD does not
need these store tables/functions or an applied-history marker for this version.

The immutable migration remains in the canonical directory and is already
applied on RMT. PRD's catch-up planner defaults to shared Tasks migrations and
excludes Ryan Meetup-only SQL, prerequisites, and history inserts.

If the earlier block was already applied on PRD, leave its objects and history
untouched. The planner tolerates those entries; this change performs no cleanup
or rollback on either hosted database.

See [migration profiles](DATABASE.md#migration-profiles) and
[the Store database guide](../../store/docs/reference/review-database.md) for current instructions.
