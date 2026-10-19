# Phase 8. Fork

[Overview](overview.md)

## Goal

A viewer copies a published strategy into their own browser and edits it. If they publish it, it links back to the original.

## Changes

- `StrategyDocSchema` gains an optional `origin`, which defaults to `null` so existing documents and export files still load without a version bump.
- The viewer gets a "Fork into my strategies" button. It saves a copy under a new `StrategyId` with `origin` set, then opens the editor. It needs no sign-in.
- The editor shows "Forked from <title> by @handle" with a link when `origin` is set.
- `publish` sends `forked_from` from `origin`. The viewer shows "Forked from …" on forks.

## Data structures

- `origin: { publishedId: PublishedId; title: string; handle: Handle } | null` on `StrategyDoc`.

## Verification

- Static. Tests cover these cases:
  - a document without `origin` parses to `origin: null`;
  - a fork gets a new id and keeps every node and connection.
- Runtime. In Chrome:
  - signed out, fork a published strategy and edit it;
  - sign in as a second user and publish the fork;
  - the fork's viewer page links to the original.
