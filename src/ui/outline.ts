import type { EdgeId, NodeId, StrategyDoc, StrategyEdge } from '../model/strategy';
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

export type PreviewLine = { depth: number; phrase: string; name: string; jump: 'back' | 'above' | null };

export function previewLines(outline: Outline, limit: number): { lines: PreviewLine[]; more: number } {
	const lines: PreviewLine[] = [];
	let total = 0;
	const stack = outline.start.next.map((entry) => ({ entry, depth: 0 })).reverse();
	for (let item = stack.pop(); item; item = stack.pop()) {
		const { entry, depth } = item;
		total += 1;
		if (lines.length < limit) {
			const jump = entry.kind === 'jump' ? (entry.back ? 'back' : 'above') : null;
			lines.push({ depth, phrase: reactionPhrase(entry.reaction), name: entry.name, jump });
		}
		if (entry.kind === 'step') {
			for (let i = entry.next.length - 1; i >= 0; i--) stack.push({ entry: entry.next[i]!, depth: depth + 1 });
		}
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
