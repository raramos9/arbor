# Phase 10. Google sign-in

[Overview](overview.md)

## Goal

Users can sign in with Google as well as by email.

## Changes

- The sign-in dialog gets a "Continue with Google" button.
- `supabase/config.toml` enables the Google provider and reads its client id and secret from environment variables.

## Needs from the user

A Google Cloud OAuth client. The redirect URI is the local stack's callback URL for testing and the hosted project's callback URL for phase 11. The user creates it and puts the values in `.env.local`. Agents never handle the secret.

## Verification

- Runtime. In Chrome, with the user signing in to Google themselves:
  - sign in and land back on the list screen;
  - pick a handle and publish.
