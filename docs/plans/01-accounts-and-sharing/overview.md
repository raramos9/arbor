# Accounts and sharing

## Context

Arbor's goal is a community site where people publish strategies, study each other's, and fork them. Today every strategy lives in one browser's `localStorage`, so nobody can see anyone else's work. This plan adds the smallest backend that gives a strategy a public link, and it leaves room for the "compare reactions" view the explore prototype pointed to.

## Scope

Included:

- Sign in with an email magic link, then with Google.
- A public handle per account, used in links and attribution.
- Publish a strategy from the editor, and republish it after more edits.
- A read-only page for any published strategy, open to people who are not signed in.
- Fork a published strategy into your own browser, with a link back to the original.
- A list of recent published strategies and a page per handle.

Excluded:

- Sync. Editing stays local, and the server holds published snapshots only.
- Recorded clips. Publishing removes clip media from the uploaded copy, and links stay.
- Compare reactions, comments, likes, and search.
- Deleting an account. Unpublishing one strategy is in scope.

## Constraints

- Signing in is never required to edit. The app works with no Supabase settings at all, as it does today.
- Never delete or rewrite the user's existing `localStorage` data, including the unused `arbor.library` key.
- Every document read from Supabase goes through `parseStrategy` before the app uses it. The database stores `jsonb`, so its shape is not trusted.
- Access rules live in row-level security, not in client code. The client only holds the publishable key.
- Keep the stack small. Add `@supabase/supabase-js` and the Supabase CLI as a dev dependency, nothing else.

## Alternatives

Chosen by the user on 2026-10-19:

- **Backend.** Supabase over a custom Node server, AWS, or Firebase. It bundles Postgres, auth, and row-level security with almost no server code.
- **Publish snapshots over sync.** Publishing copies the current document up. Sync would need conflict handling and offline rules that no one has asked for.
- **One `jsonb` document per row over normalized node and edge tables.** The app already validates whole documents. A derived connections table for comparing reactions can be built from these rows later.
- **No clips in the first version.** Video upload brings storage costs, size limits, and upload progress. Links already cover most media.

## Applicable skills

- `how` over `src/ui/EditorScreen.tsx` and `src/storage.ts` before phases 6 to 8.
- `typescript-best-practices` for every `.ts` and `.tsx` change.
- `claude-in-chrome` for runtime checks.
- `frontend-design` for the sign-in, handle, and viewer screens.

## Phases

1. [Local Supabase scaffold](phase-1-scaffold.md)
2. [Schema and access rules](phase-2-schema.md)
3. [The publishing boundary](phase-3-boundary.md)
4. [Magic-link sign-in](phase-4-sign-in.md)
5. [Choosing a handle](phase-5-handle.md)
6. [Publish and unpublish](phase-6-publish.md)
7. [Read-only viewer](phase-7-viewer.md)
8. [Fork](phase-8-fork.md)
9. [Explore and profile pages](phase-9-explore.md)
10. [Google sign-in](phase-10-google.md)
11. [Hosted project and deploy](phase-11-deploy.md)

Phases run against the hosted Supabase project `arbor` (ref `ifawdayiauatkwfbwzru`, organization `ira`, free plan, us-east-1), created on 2026-10-19 and managed through the Supabase plugin. Migrations are committed under `supabase/migrations/` so the schema stays reproducible. Phase 10 needs a Google Cloud OAuth client. Phase 11 needs a hosting choice and the user's go-ahead, because it puts the app on the public internet.

## Verification

- `npm run build` type-checks and builds.
- `npm test` runs the Vitest suite.
- `npx supabase test db` runs the SQL access-rule tests against a local stack in Docker from phase 2 onward.
- Runtime checks run in Chrome against `npx vite --port 5199 --strictPort` and the hosted project, so the user's real browser data is untouched.

See [testing.md](testing.md) for the runtime scenarios.

## Implementation guidance

- Run `how` over each unfamiliar subsystem before changing it.
- Run `interrogate` on the phase 2 access rules before phase 6 ships, because a wrong rule leaks or destroys other people's work.
- Run `/deslop` over each diff before commit, and `unslop` over README and PR text.
- One PR per phase. Each PR lands green before the next starts.
- No Claude co-author trailer on commits or PRs in this repo.
