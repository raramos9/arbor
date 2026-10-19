# Phase 7. Read-only viewer

[Overview](overview.md)

## Goal

Anyone with a link sees a published strategy on the canvas and reads its notes, labels, and links. No sign-in, no editing.

## Changes

- `src/route.ts` gains `{ page: 'published'; id: PublishedId }` at `#/p/<id>`.
- A viewer screen fetches the row, runs `parsePublished`, and renders the canvas with dragging, connecting, and deleting turned off.
- The side panel shows fields as text, not inputs. Read-only mode is a prop on the existing components, not a second copy of them.
- The header shows the title, `@handle`, and the published date.
- A missing or malformed row shows a clear "This strategy isn't available" screen.

## Data structures

- `Route` gains the `published` variant.
- `Inspector` and the canvas take `mode: 'edit' | 'view'`.

## Verification

- Static. `parseHash` tests for `#/p/<id>`.
- Runtime. In Chrome:
  - open a published link in a signed-out window;
  - see the graph, click a node and a connection, and play a YouTube link;
  - confirm nothing can be dragged, connected, or edited;
  - a made-up id shows the unavailable screen.
