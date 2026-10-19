# Phase 5. Choosing a handle

[Overview](overview.md)

## Goal

A signed-in user picks a public handle once. Publishing requires it.

## Changes

- `useSession` also loads the user's profile, so the signed-in state carries `handle: Handle | null`.
- A handle form appears the first time a signed-in user without a handle tries to publish, and from the account control. It checks the format locally and reports a taken handle from the unique-constraint error.

## Data structures

- `SessionState` signed-in variant gains `handle: Handle | null`.

## Verification

- Static. Tests cover handle format parsing.
- Runtime. In Chrome:
  - pick a handle and see it in the header;
  - a second account trying the same handle sees "That handle is taken".
