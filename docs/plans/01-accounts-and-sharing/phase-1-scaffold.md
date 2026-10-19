# Phase 1. Local Supabase scaffold

[Overview](overview.md)

## Goal

The app can reach the hosted Supabase project when configured. Nothing changes for users.

## Changes

- Add the Supabase CLI as a dev dependency and run `supabase init`, which creates `supabase/config.toml`.
- Add `@supabase/supabase-js`.
- Add `src/supabase.ts`. It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and exports one client, or `null` when either is missing. The rest of the app treats `null` as "sharing is unavailable".
- Add `.env.example` with placeholders. Ignore `.env.local`.
- README gets a short "Sharing (optional)" section.

## Data structures

- `cloud: SupabaseClient | null`. Phase 2 adds the generated `Database` type.

## Verification

- Static. `npm run build` and `npm test` pass with and without `.env.local`.
- Runtime. With no env file, the app behaves exactly as before. With `.env.local` pointing at the hosted project, a one-off `cloud.auth.getSession()` call in the console resolves without a network error.
