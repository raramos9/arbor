# Phase 4. Magic-link sign-in

[Overview](overview.md)

## Goal

A user can sign in with their email and sign out. Signing in changes nothing about local editing.

## Changes

- `src/ui/useSession.ts` subscribes to Supabase auth state and returns the current session state.
- A small account control in the list screen header shows "Sign in" or the user's email and "Sign out". It is hidden when `cloud` is `null`.
- A sign-in dialog takes an email and sends a magic link. It shows "Check your email" afterwards.
- The magic link returns to the list screen. The hash router ignores Supabase's auth fragment instead of treating it as a route.

## Data structures

- `SessionState = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; userId: UserId; email: string }`.

## Verification

- Static. `npm run build` and `npm test` pass. A `parseHash` test shows an auth-callback fragment resolves to the list route.
- Runtime. In Chrome on port 5199:
  - request a link, open it from the local mail viewer, and see the email in the header;
  - reload and stay signed in;
  - sign out;
  - confirm existing local strategies are untouched throughout.
