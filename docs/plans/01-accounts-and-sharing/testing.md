# Testing

[Overview](overview.md)

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the hosted project's URL and publishable key.
2. `npx supabase start` brings up a local Postgres in Docker for the SQL access-rule tests.
3. `npx vite --port 5199 --strictPort` keeps test data away from the user's normal dev server.

## Layers

- **Pure logic.** Vitest, for clip stripping, row parsing, handle format, routes, and fork copies.
- **Access rules.** pgTAP through `npx supabase test db`. These are the only tests that prove one user cannot touch another's work.
- **Runtime.** Chrome against port 5199. Each phase file lists its scenarios. A second user means a second browser profile or a private window.

## Gaps

There is no CI in this repo yet, so every check runs locally before each PR.
