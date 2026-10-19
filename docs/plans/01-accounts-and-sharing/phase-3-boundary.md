# Phase 3. The publishing boundary

[Overview](overview.md)

## Goal

Pure functions decide what gets uploaded and how a downloaded row becomes a document the app trusts. No network calls and no UI.

## Changes

- New `src/model/publishing.ts`.
- `prepareForPublish(doc)` returns a copy with every `clip` media item removed from nodes and connections, and the number removed. Links are kept.
- `parsePublished(row)` runs the row's `doc` through `parseStrategy` and returns a `PublishedStrategy` or an error, never a half-trusted value.
- Tests in `src/model/publishing.test.ts`.

## Data structures

- `PublishedStrategy = { id: PublishedId; owner: { id: UserId; handle: Handle }; doc: StrategyDoc; forkedFrom: PublishedId | null; publishedAt: string; updatedAt: string }`.
- Branded `PublishedId`, `UserId`, and `Handle` in zod, matching the style of `NodeIdSchema`.

## Verification

- Static. Tests cover these cases:
  - clips are stripped from nodes and connections, and the count is right;
  - links survive;
  - the input document is not mutated;
  - a row with a malformed `doc` is rejected with a readable reason.
- Runtime. Not needed. Pure code.
