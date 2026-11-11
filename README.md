# Ryan Meetup Platform

This repository contains the Ryan Meetup applications and their shared design
system.

## Workspaces

- `apps/ryanmeetup` — Ryan Meetup website
- `apps/ryancon` — RyanCon website
- `packages/ui` — shared React UI primitives
- `packages/brand` — shared Cooper font and Tailwind brand tokens

## Local development

Use Node.js 22.13 or later on a supported release line (22, 24, or 26+).
Install all dependencies from the repository root with `npm install`, then run
either application with `npm run dev:ryanmeetup` or `npm run dev:ryancon`.

Use `npm run build` to build every workspace.

Type checks use TypeScript 7 through the `@typescript/native` npm alias, which
provides `tsc`. The `typescript` dependency aliases `@typescript/typescript6`
so Next.js and ESLint can still use the compiler API that TypeScript 7 does
not yet provide. Keep both aliases together when updating the toolchain.

## Vercel

Keep each application as a separate Vercel project connected to this Git
repository. Set the Ryan Meetup Root Directory to `apps/ryanmeetup` and the RyanCon
Root Directory to `apps/ryancon`.

Both projects consume the internal `@ryanmeetup/ui` and `@ryanmeetup/brand`
packages. Shared-package changes affect both projects; app-only changes can skip
the unaffected project.
