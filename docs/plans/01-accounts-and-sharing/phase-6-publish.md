# Phase 6. Publish and unpublish

[Overview](overview.md)

## Goal

From the editor, a user publishes the current strategy, republishes it after edits, and unpublishes it. They get a link they can share.

## Changes

- New `src/publishing.ts` holds the network calls. `publish(doc)` runs `prepareForPublish` and upserts on `(owner, local_id)`. `unpublish(localId)` deletes the row. `findMine(localId)` looks up the existing row.
- The editor toolbar gets a Publish button next to Export. It opens sign-in or the handle form when needed.
- The confirmation names how many recorded clips stay on this device.
- After publishing, the toolbar shows "Published", a copy-link button, "Update" when the local copy changed since then, and "Unpublish".

## Data structures

- `PublishState = { kind: 'unpublished' } | { kind: 'published'; id: PublishedId; publishedDoc: StrategyDoc } | { kind: 'error'; message: string }`. "Has changes" compares the stripped local document with `publishedDoc`.

## Verification

- Static. Tests cover the "has changes" comparison.
- Runtime. In Chrome:
  - publish a strategy that has one link and one clip;
  - the confirmation says one clip stays local;
  - the row exists with the link and without the clip;
  - edit, see "Update", update, and still have one row;
  - unpublish and the row is gone while the local strategy remains.
