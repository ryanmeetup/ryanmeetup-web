# Tasks versioning

Tasks follows Semantic Versioning with one deliberate pre-1.0 convention. Every
public release uses all three numeric parts: `MAJOR.MINOR.PATCH`.

## Before 1.0.0

- `0.MINOR.0` marks a meaningful user-facing capability, workflow, or product
  milestone. Breaking changes may also require a new minor version while the
  app remains in beta.
- `0.MINOR.PATCH` marks a contained fix, reliability change, dependency update,
  or small improvement that does not establish a new product milestone.
- A group of small improvements can become a minor release when it forms a
  coherent user-facing change. The release story matters more than the number
  of commits.
- `1.0.0` is reserved for the explicit production-readiness release. It does
  not follow automatically from `0.9.0`; `0.10.0`, `0.11.0`, and later beta
  versions are valid.

## Release sources

The Markdown entries in `changelog/` are the public release history and the
source of the version shown in the app. `package.json` carries the latest Tasks
product version so build metadata agrees with that history. Other apps and
shared packages in the monorepo keep their own versions; they do not inherit the
Tasks version.

Each release entry must:

1. use a quoted three-part version in frontmatter so YAML never turns `0.10.0`
   into a number;
2. describe one coherent shipped increment instead of remaining open as a
   rolling bucket;
3. keep its slug stable after publication so saved changelog links continue to
   work; and
4. call out remaining beta limitations when they materially qualify the work.

Use a patch release when the work is mainly corrective. Use a minor release
when users gain a new thing they can do or an existing workflow changes enough
to deserve its own release story. Commit prefixes help with that judgment, but
they do not choose the version on their own.

## Production release

The decision to publish `1.0.0` should be made against an explicit readiness
check covering the supported workflows, access controls, database migrations
for both instances, recovery paths, monitoring, documentation, and the known
beta limitations recorded in the changelog. After 1.0.0, normal Semantic
Versioning applies: breaking changes increment major, backward-compatible
capabilities increment minor, and fixes increment patch.
