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
	const path = new Set<NodeId>();

	function expand(node: NodeId, via: StrategyEdge | null): OutlineStep {
		visited.add(node);
		path.add(node);
		const next: OutlineEntry[] = [];
		for (const edge of outgoing.get(node) ?? []) {
			const target = doc.nodes[edge.to];
			if (!target) continue;
			if (visited.has(target.id)) {
				next.push({
					kind: 'jump',
					edge: edge.id,
					reaction: edge.label,
					node: target.id,
					name: target.name,
					back: path.has(target.id),
				});
			} else {
				next.push(expand(target.id, edge));
			}
		}
		path.delete(node);
		return {
			kind: 'step',
			edge: via?.id ?? null,
			reaction: via?.label ?? '',
			node,
			name: doc.nodes[node]?.name ?? '',
			next,
		};
	}

	const start = expand(doc.rootNodeId, null);
	const unlinked: OutlineStep[] = [];
	for (const node of Object.values(doc.nodes)) {
		if (!visited.has(node.id)) unlinked.push(expand(node.id, null));
	}
	return { start, unlinked };
}

export function reactionPhrase(reaction: string): string {
	if (reaction === '') return 'then';
	if (/^he /i.test(reaction)) return `if he ${reaction.slice(3)}`;
	return `if ${reaction}`;
}

export function isLit(entry: OutlineEntry, selection: Selection): boolean {
	if (!selection) return false;
	if (selection.type === 'edge') return entry.edge === selection.id;
	return entry.kind === 'step' && entry.node === selection.id;
}
