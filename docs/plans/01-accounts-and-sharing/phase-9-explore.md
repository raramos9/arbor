# Phase 9. Explore and profile pages

[Overview](overview.md)

## Goal

People find published strategies without being sent a link.

## Changes

- `#/explore` lists recent published strategies with title, handle, ruleset, starting side, and date, newest first, 50 per page.
- `#/u/<handle>` lists one user's published strategies.
- The list screen links to Explore. Handles everywhere link to profile pages.
- List queries select only the columns they show, not `doc`.

## Data structures

- `PublishedSummary = { id; title; handle; ruleset; startingSide; updatedAt }`. Ruleset and starting side come from generated columns on `published_strategies`, so lists never download whole documents.

## Verification

- Static. `parseHash` tests for both routes.
- Runtime. In Chrome:
  - with strategies from two users, Explore shows both, newest first;
  - a profile page shows only that user's strategies;
  - an unknown handle shows "No one has that handle".
