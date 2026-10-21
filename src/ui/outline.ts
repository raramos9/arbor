import { reactionKey, type EdgeId, type NodeId, type StrategyDoc, type StrategyEdge } from '../model/strategy';
import type { Selection } from './flow';

export type OutlineStep = {
	kind: 'step';
	edge: EdgeId | null;
	reaction: string;
	node: NodeId;
	name: string;
	next: OutlineEntry[];
};
export type OutlineJump = {
	kind: 'jump';
	edge: EdgeId;
	reaction: string;
	node: NodeId;
	name: string;
	back: boolean;
};
export type OutlineEntry = OutlineStep | OutlineJump;
export type Outline = { start: OutlineStep; unlinked: OutlineStep[] };

// Each node is expanded once, so row count stays at nodes + edges even when paths fan out and rejoin.
export function toOutline(doc: StrategyDoc): Outline {
	const outgoing = new Map<NodeId, StrategyEdge[]>();
	for (const edge of Object.values(doc.edges)) {
		const list = outgoing.get(edge.from);
		if (list) list.push(edge);
		else outgoing.set(edge.from, [edge]);
	}
	const visited = new Set<NodeId>();

	const stepAt = (node: NodeId, via: StrategyEdge | null): OutlineStep => ({
		kind: 'step',
		edge: via?.id ?? null,
		reaction: via?.label ?? '',
		node,
		name: doc.nodes[node]?.name ?? '',
		next: [],
	});

	// Iterative because published docs are untrusted: a long enough chain overflows the call stack.
	function expand(node: NodeId, via: StrategyEdge | null): OutlineStep {
		const top = stepAt(node, via);
		visited.add(node);
		const path = new Set<NodeId>([node]);
		const stack = [{ step: top, edges: outgoing.get(node) ?? [], index: 0 }];
		while (stack.length > 0) {
			const frame = stack[stack.length - 1]!;
			const edge = frame.edges[frame.index++];
			if (!edge) {
				path.delete(frame.step.node);
				stack.pop();
				continue;
			}
			const target = doc.nodes[edge.to];
			if (!target) continue;
			if (visited.has(target.id)) {
				frame.step.next.push({
					kind: 'jump',
					edge: edge.id,
					reaction: edge.label,
					node: target.id,
					name: target.name,
					back: path.has(target.id),
				});
				continue;
			}
			visited.add(target.id);
			path.add(target.id);
			const child = stepAt(target.id, edge);
			frame.step.next.push(child);
			stack.push({ step: child, edges: outgoing.get(target.id) ?? [], index: 0 });
		}
		return top;
	}

	const start = expand(doc.rootNodeId, null);
	const unlinked: OutlineStep[] = [];
	for (const node of Object.values(doc.nodes)) {
		if (!visited.has(node.id)) unlinked.push(expand(node.id, null));
	}
	return { start, unlinked };
}

export function reactionPhrase(typed: string): string {
	const reaction = typed.replace(/^if /i, '');
	if (reaction === '') return 'then';
	if (/^he /i.test(reaction)) return `if he ${reaction.slice(3)}`;
	return `if ${reaction}`;
}

export type PreviewLine =
	| { depth: number; phrase: string; name: string; jump: 'back' | 'above' | null }
	| { depth: number; phrase: string; options: number };

type PreviewItem =
	| { kind: 'entry'; entry: OutlineEntry; depth: number; grouped: boolean }
	| { kind: 'group'; phrase: string; entries: OutlineEntry[]; depth: number };

type PreviewNode = { line: PreviewLine; children: PreviewNode[] };

// Breadth first picks which lines fit, so one outcome's descendants cannot crowd out its siblings.
// Depth first then prints them, and a line is only picked after its parent, so no line is orphaned.
// A grouped outcome carries no phrase of its own: the group line above it already says the reaction.
export function previewLines(outline: Outline, limit: number): { lines: PreviewLine[]; more: number } {
	const childItems = (entries: readonly OutlineEntry[], depth: number): PreviewItem[] =>
		groupSameReaction(entries).map((row) =>
			row.kind === 'entry'
				? { kind: 'entry', entry: row.entry, depth, grouped: false }
				: { kind: 'group', phrase: row.phrase, entries: row.entries, depth },
		);
	const lineOf = (item: PreviewItem): PreviewLine => {
		if (item.kind === 'group') return { depth: item.depth, phrase: item.phrase, options: item.entries.length };
		const { entry, depth, grouped } = item;
		const jump = entry.kind === 'jump' ? (entry.back ? 'back' : 'above') : null;
		return { depth, phrase: grouped ? '' : reactionPhrase(entry.reaction), name: entry.name, jump };
	};
	const work: { node: PreviewNode; item: PreviewItem }[] = [];
	const grow = (items: PreviewItem[], into: PreviewNode[]) => {
		for (const item of items) {
			const node = { line: lineOf(item), children: [] };
			into.push(node);
			work.push({ node, item });
		}
	};

	const roots: PreviewNode[] = [];
	grow(childItems(outline.start.next, 0), roots);
	let total = 0;
	for (let next = work.pop(); next; next = work.pop()) {
		total += 1;
		const { node, item } = next;
		if (item.kind === 'group') {
			grow(item.entries.map((entry) => ({ kind: 'entry', entry, depth: item.depth + 1, grouped: true })), node.children);
		} else if (item.entry.kind === 'step') {
			grow(childItems(item.entry.next, item.depth + 1), node.children);
		}
	}

	const picked = new Set<PreviewNode>();
	const queue = [...roots];
	for (let head = 0; head < queue.length && picked.size < limit; head++) {
		picked.add(queue[head]!);
		queue.push(...queue[head]!.children);
	}

	const lines: PreviewLine[] = [];
	const stack = roots.slice().reverse();
	for (let node = stack.pop(); node; node = stack.pop()) {
		if (!picked.has(node)) continue;
		lines.push(node.line);
		for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]!);
	}
	return { lines, more: total - lines.length };
}

export function isLit(entry: OutlineEntry, selection: Selection): boolean {
	if (!selection) return false;
	if (selection.type === 'edge') return entry.edge === selection.id;
	return entry.kind === 'step' && entry.node === selection.id;
}

export function entrySelection(entry: OutlineEntry): Selection {
	return entry.kind === 'jump' ? { type: 'edge', id: entry.edge } : { type: 'node', id: entry.node };
}

export type OutlineRow = { kind: 'entry'; entry: OutlineEntry } | { kind: 'group'; phrase: string; entries: OutlineEntry[] };

// Siblings that share a typed reaction are the outcomes of one reaction, so they sit under it once.
export function groupSameReaction(entries: readonly OutlineEntry[]): OutlineRow[] {
	const keyOf = (entry: OutlineEntry) => reactionKey(entry.reaction);
	const counts = new Map<string, number>();
	for (const entry of entries) counts.set(keyOf(entry), (counts.get(keyOf(entry)) ?? 0) + 1);
	const rows: OutlineRow[] = [];
	const groups = new Map<string, { kind: 'group'; phrase: string; entries: OutlineEntry[] }>();
	for (const entry of entries) {
		const key = keyOf(entry);
		if (key === '' || counts.get(key)! < 2) {
			rows.push({ kind: 'entry', entry });
			continue;
		}
		const group = groups.get(key);
		if (group) {
			group.entries.push(entry);
			continue;
		}
		const created = { kind: 'group' as const, phrase: reactionPhrase(entry.reaction.trim()), entries: [entry] };
		groups.set(key, created);
		rows.push(created);
	}
	return rows;
}
