# Arbor

Arbor maps Brazilian Jiu-Jitsu strategies as decision graphs. You start from a situation, add what you try next, and branch on how your opponent reacts. Each branch leads to your next option, and you can keep going until a line ends.

A strategy is one person's game plan, not a rule about the correct response. The long-term goal is a community site where people publish their strategies, study each other's, and fork them into their own versions.

## Status

Early. The editor works and saves to your browser. Accounts and sharing are in progress; see `docs/plans/01-accounts-and-sharing/`.

What works today:

- Create a strategy with a starting node, a ruleset (gi, no-gi, or both), and a starting side (top, bottom, or standing).
- Add nodes to a canvas you can pan and zoom. A node is a situation or a move, and you name it however you like.
- Connect nodes by dragging from one to the next. A connection can carry a label that records how your opponent reacts.
- Edit names, labels, and plain-text notes in the side panel. Drag nodes to arrange them. Delete nodes and connections.
- Attach media to any node or connection. YouTube links show a thumbnail and play in the side panel, starting at the link's timestamp. Instagram and other links open in a new tab.
- Record or upload your own clips. On a phone, "Record clip" opens the camera. Clips are stored in your browser's IndexedDB, so they stay on the device that added them unless you export the strategy.
- Export a strategy from the editor as an `.arbor.json` file and import it from the list screen. Clips travel inside the file. Importing a strategy that already exists in this browser asks before replacing it.
- Close the browser and come back. Strategies save to `localStorage` after every change.
- Strategies saved in the older format, and files exported from them, still open. Their node types and who-moves settings are dropped, and their labels are kept.

## Run it

You need Node.js 18 or later.

```sh
npm install
npm run dev
```

Open the address Vite prints.

### Sharing (optional)

Publishing and signing in use [Supabase](https://supabase.com). Without it, everything else works and nothing leaves your browser. To turn it on, copy `.env.example` to `.env.local` and fill in your project's URL and publishable key.

Other scripts:

- `npm test` runs the unit tests with Vitest.
- `npm run build` type-checks the project and builds it into `dist/`.

## How a strategy is modeled

A strategy is a graph, not a tree, because BJJ sequences loop back to positions you have already been in.

- A **node** is a situation or a move that you name freely, such as "Collar tie with inside control" or "Arm drag". A node with nothing after it is where that line ends.
- A **connection** leads from one node to the next. Its optional label records your opponent's reaction. For example, "Collar tie with inside control" leads to "Arm drag" with the label "He circles his arm in and regains control".
- A **strategy** is one JSON document. It holds its nodes, its connections, and a separate `layout` map of node positions, so where a node sits on the canvas never changes what it means.

Loading a strategy runs it through a [zod](https://zod.dev) schema and a few rules the schema cannot express. For example, the starting node must exist, and every connection must join two different existing nodes. After that check, the rest of the app trusts the data.

## Project layout

- `src/model/strategy.ts` defines the strategy schema and types, the load-time checks, and `createStrategy`.
- `src/model/commands.ts` defines every edit as a command. `apply` is the only function that changes a strategy, and it explains any change it refuses.
- `src/model/exchange.ts` defines the export file format and decides what an import should do. `src/exchange.ts` reads clips and writes the file.
- `src/storage.ts` saves and loads strategies in `localStorage`.
- `src/supabase.ts` creates the Supabase client, or `null` when sharing is not configured.
- `supabase/` holds the Supabase configuration and database migrations.
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

After that:

1. Move storage to Postgres and add accounts, and upload clips to cloud storage so they can be shared.
2. Publish strategies, public or private, with a way to report content.
3. Profiles and shareable strategy pages.
4. Fork a strategy into your own editable copy, with credit to the original.
5. Discovery by position, technique, author, and tags.
6. Drilling mode, where the app picks your opponent's reactions.
