# Phase 2. Schema and access rules

[Overview](overview.md)

## Goal

The database can hold profiles and published strategies, and row-level security enforces who may read and write them.

## Changes

- One migration in `supabase/migrations/` creates both tables, the constraints, the policies, and the trigger.
- `profiles` has one row per auth user. A trigger on `auth.users` inserts it on sign-up with a null handle.
- `published_strategies` holds one row per published strategy. `(owner, local_id)` is unique, so republishing the same local strategy updates its row instead of adding a second one.
- Policies:
  - anyone, signed in or not, may read profiles and published strategies;
  - a user may update only their own profile;
  - a user may insert, update, or delete only their own published strategies, and only once their handle is set.
- Check constraints on handle format (lowercase letters, digits, and hyphens, 3 to 24 characters), on `jsonb_typeof(doc) = 'object'`, and on document size (under 512 KB).
- Apply the migration to the hosted project and generate `src/database.types.ts` from it.
- SQL tests in `supabase/tests/` with pgTAP.

## Data structures

- `profiles(id uuid pk → auth.users, handle text unique null, created_at)`.
- `published_strategies(id uuid pk, owner uuid → profiles, local_id text, title text, doc jsonb, forked_from uuid null → published_strategies on delete set null, published_at, updated_at, unique(owner, local_id))`.

## Verification

- Static. `npx supabase test db` covers these cases:
  - an anonymous user can read a published strategy but cannot insert one;
  - user B cannot update or delete user A's row;
  - a user without a handle cannot publish;
  - publishing the same `local_id` twice leaves one row;
  - an oversized document is rejected.
- Runtime. Not needed. There is no UI yet.
- Run `interrogate` on the policies before phase 6.
