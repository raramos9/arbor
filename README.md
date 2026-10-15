# Arbor

Arbor maps Brazilian Jiu-Jitsu strategies as decision graphs. You start from a position, add the techniques you attempt, and branch on how your opponent reacts. Each branch leads to your next option, and you can keep going until a line ends in a submission.

A strategy is one person's game plan, not a rule about the correct response. The long-term goal is a community site where people publish their strategies, study each other's, and fork them into their own versions.

## Status

Early. The editor works and saves to your browser. There are no accounts, no server, and no sharing yet.

What works today:

- Create a strategy with a starting position, a ruleset (gi, no-gi, or both), and a starting side (top, bottom, or standing).
- Add positions, techniques, and submissions to a canvas you can pan and zoom.
- Pick a technique from a small seed library, or make your own. A picked technique copies its kind, name, and description into a new node, so later library changes never alter your strategy.
- Connect nodes. Every connection says who moves: you, or your opponent. An opponent connection needs a label that describes the reaction.
- Edit names, kinds, and plain-text notes in the side panel. Drag nodes to arrange them. Delete nodes and connections.
- Attach media to any node or connection. YouTube links show a thumbnail and play in the side panel, starting at the link's timestamp. Instagram and other links open in a new tab.
- Record or upload your own clips. On a phone, "Record clip" opens the camera. Clips are stored in your browser's IndexedDB, so they stay on the device that added them and are not backed up.
- Close the browser and come back. Strategies save to `localStorage` after every change.

## Run it

You need Node.js 18 or later.

```sh
npm install
npm run dev
```

Open the address Vite prints. Other scripts:

- `npm test` runs the unit tests with Vitest.
- `npm run build` type-checks the project and builds it into `dist/`.

## How a strategy is modeled

A strategy is a graph, not a tree, because BJJ sequences loop back to positions you have already been in.

- A **node** is something you are in or something you do: a `position`, a `technique`, or a `submission`. A node with nothing after it is where that line ends.
- An **edge** is a move from one node to the next. Its `actor` is `me` or `opponent`. Opponent edges need a label, because that label is the reaction you choose between when you study the strategy.
- A **strategy** is one JSON document. It holds its nodes, its edges, and a separate `layout` map of node positions, so where a node sits on the canvas never changes what it means.

Loading a strategy runs it through a [zod](https://zod.dev) schema and a few rules the schema cannot express. For example, the starting node must be a position, and every edge must connect two existing nodes. After that check, the rest of the app trusts the data.

## Project layout

- `src/model/strategy.ts` defines the strategy schema and types, the load-time checks, and `createStrategy`.
- `src/model/library.json` is the seed technique library. `src/model/library.ts` checks it on load and searches it.
- `src/model/commands.ts` defines every edit as a command. `apply` is the only function that changes a strategy, and it explains any change it refuses.
- `src/storage.ts` saves and loads strategies in `localStorage`.
- `src/ui/` holds the list screen, the editor, and the side panel. `src/ui/flow.ts` is the only file that converts between a strategy and the node and edge lists React Flow expects.

## Stack

- [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org), built with [Vite](https://vite.dev).
- [React Flow](https://reactflow.dev) for the canvas, so the project does not build pan, zoom, and drag-to-connect itself.
- [zod](https://zod.dev) for checking data at the edge of the app.
- [Vitest](https://vitest.dev) for tests.

There is no backend yet. Postgres and accounts arrive when strategies need to leave your browser.

## Roadmap

The first milestone finishes the single-user experience:

1. Study mode: walk a strategy one decision at a time, choosing your options and your opponent's reactions.
2. Export and import strategies as JSON files.

After that:

1. Move storage to Postgres and add accounts, and upload clips to cloud storage so they can be shared.
2. Publish strategies, public or private, with a way to report content.
3. Profiles and shareable strategy pages.
4. Fork a strategy into your own editable copy, with credit to the original.
5. Discovery by position, technique, author, and tags.
6. Drilling mode, where the app picks your opponent's reactions.
