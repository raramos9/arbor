import type { Position } from './positions';
import {
	type EdgeId,
	type Media,
	type NodeId,
	type Ruleset,
	type Side,
	type StrategyDoc,
	type StrategyEdge,
	type StrategyNode,
} from './strategy';

export type MediaOwner = { type: 'node'; id: NodeId } | { type: 'edge'; id: EdgeId };

export type Command =
	| { type: 'addNode'; id: NodeId; name: string; at?: { x: number; y: number } }
	| { type: 'addReaction'; from: NodeId; edge: EdgeId; node: NodeId; at: { x: number; y: number } }
	| { type: 'updateNode'; id: NodeId; patch: { name?: string; notes?: string } }
	| { type: 'deleteNode'; id: NodeId }
	| {
			type: 'connect';
			id: EdgeId;
			from: NodeId;
			to: NodeId;
			label: string;
	  }
	| {
			type: 'updateEdge';
			id: EdgeId;
			patch: { label?: string; notes?: string };
	  }
	| { type: 'deleteEdge'; id: EdgeId }
	| { type: 'moveNode'; id: NodeId; at: { x: number; y: number } }
	| { type: 'setRoot'; id: NodeId }
	| { type: 'addMedia'; owner: MediaOwner; media: Media }
	| { type: 'updateMediaTitle'; owner: MediaOwner; index: number; title: string }
	| { type: 'removeMedia'; owner: MediaOwner; index: number }
	| {
			type: 'updateMeta';
			patch: {
				title?: string;
				description?: string;
				ruleset?: Ruleset;
				startingSide?: Side;
				position?: Position | null;
			};
	  };

export type ApplyResult = { ok: true; doc: StrategyDoc } | { ok: false; reason: string };

const refuse = (reason: string): ApplyResult => ({ ok: false, reason });

function omit<V>(record: Record<string, V>, key: string): Record<string, V> {
	return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function stamp(doc: StrategyDoc): StrategyDoc {
	return { ...doc, updatedAt: new Date().toISOString() };
}

function ownerMedia(doc: StrategyDoc, owner: MediaOwner): readonly Media[] | null {
	const target = owner.type === 'node' ? doc.nodes[owner.id] : doc.edges[owner.id];
	return target ? target.media : null;
}

function withMedia(doc: StrategyDoc, owner: MediaOwner, media: Media[]): StrategyDoc {
	if (owner.type === 'node') {
		const node = doc.nodes[owner.id];
		return node ? stamp({ ...doc, nodes: { ...doc.nodes, [owner.id]: { ...node, media } } }) : doc;
	}
	const edge = doc.edges[owner.id];
	return edge ? stamp({ ...doc, edges: { ...doc.edges, [owner.id]: { ...edge, media } } }) : doc;
}

function inRange(list: readonly unknown[], index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < list.length;
}

function withNode(doc: StrategyDoc, node: StrategyNode, at?: { x: number; y: number }): StrategyDoc {
	return stamp({
		...doc,
		nodes: { ...doc.nodes, [node.id]: node },
		layout: at ? { ...doc.layout, [node.id]: at } : doc.layout,
	});
}

export function apply(doc: StrategyDoc, cmd: Command): ApplyResult {
	switch (cmd.type) {
		case 'addNode': {
			if (doc.nodes[cmd.id]) return refuse('A node with that id already exists.');
			const node: StrategyNode = {
				id: cmd.id,
				name: cmd.name,
				notes: '',
				media: [],
			};
			return { ok: true, doc: withNode(doc, node, cmd.at) };
		}
		case 'addReaction': {
			if (!doc.nodes[cmd.from]) return refuse('That node does not exist.');
			if (doc.edges[cmd.edge]) return refuse('An edge with that id already exists.');
			if (doc.nodes[cmd.node]) return refuse('A node with that id already exists.');
			const node: StrategyNode = { id: cmd.node, name: '', notes: '', media: [] };
			const edge: StrategyEdge = { id: cmd.edge, from: cmd.from, to: cmd.node, label: '', notes: '', media: [] };
			const withChild = withNode(doc, node, cmd.at);
			return { ok: true, doc: { ...withChild, edges: { ...withChild.edges, [cmd.edge]: edge } } };
		}
		case 'updateNode': {
			const node = doc.nodes[cmd.id];
			if (!node) return refuse('That node does not exist.');
			const next: StrategyNode = {
				...node,
				name: cmd.patch.name ?? node.name,
				notes: cmd.patch.notes ?? node.notes,
			};
			return { ok: true, doc: stamp({ ...doc, nodes: { ...doc.nodes, [cmd.id]: next } }) };
		}
		case 'deleteNode': {
			if (!doc.nodes[cmd.id]) return refuse('That node does not exist.');
			if (cmd.id === doc.rootNodeId) {
				return refuse('The start node cannot be deleted. Set another node as the start first.');
			}
			const edges = Object.fromEntries(
				Object.entries(doc.edges).filter(([, e]) => e.from !== cmd.id && e.to !== cmd.id),
			);
			return {
				ok: true,
				doc: stamp({
					...doc,
					nodes: omit(doc.nodes, cmd.id),
					edges,
					layout: omit(doc.layout, cmd.id),
				}),
			};
		}
		case 'connect': {
			if (doc.edges[cmd.id]) return refuse('An edge with that id already exists.');
			if (!doc.nodes[cmd.from] || !doc.nodes[cmd.to]) return refuse('Both ends must be existing nodes.');
			if (cmd.from === cmd.to) return refuse('A node cannot connect to itself.');
			const edge: StrategyEdge = { id: cmd.id, from: cmd.from, to: cmd.to, label: cmd.label.trim(), notes: '', media: [] };
			return { ok: true, doc: stamp({ ...doc, edges: { ...doc.edges, [cmd.id]: edge } }) };
		}
		case 'updateEdge': {
			const edge = doc.edges[cmd.id];
			if (!edge) return refuse('That edge does not exist.');
			const next: StrategyEdge = {
				...edge,
				label: cmd.patch.label?.trim() ?? edge.label,
				notes: cmd.patch.notes ?? edge.notes,
			};
			return { ok: true, doc: stamp({ ...doc, edges: { ...doc.edges, [cmd.id]: next } }) };
		}
		case 'deleteEdge': {
			if (!doc.edges[cmd.id]) return refuse('That edge does not exist.');
			return { ok: true, doc: stamp({ ...doc, edges: omit(doc.edges, cmd.id) }) };
		}
		case 'moveNode': {
			if (!doc.nodes[cmd.id]) return refuse('That node does not exist.');
			return { ok: true, doc: stamp({ ...doc, layout: { ...doc.layout, [cmd.id]: cmd.at } }) };
		}
		case 'setRoot': {
			if (!doc.nodes[cmd.id]) return refuse('That node does not exist.');
			return { ok: true, doc: stamp({ ...doc, rootNodeId: cmd.id }) };
		}
		case 'addMedia': {
			const current = ownerMedia(doc, cmd.owner);
			if (!current) return refuse(`That ${cmd.owner.type} does not exist.`);
			return { ok: true, doc: withMedia(doc, cmd.owner, [...current, cmd.media]) };
		}
		case 'updateMediaTitle': {
			const current = ownerMedia(doc, cmd.owner);
			if (!current) return refuse(`That ${cmd.owner.type} does not exist.`);
			if (!inRange(current, cmd.index)) return refuse('That media item does not exist.');
			const next = current.map((item, i) => (i === cmd.index ? { ...item, title: cmd.title } : item));
			return { ok: true, doc: withMedia(doc, cmd.owner, next) };
		}
		case 'removeMedia': {
			const current = ownerMedia(doc, cmd.owner);
			if (!current) return refuse(`That ${cmd.owner.type} does not exist.`);
			if (!inRange(current, cmd.index)) return refuse('That media item does not exist.');
			return { ok: true, doc: withMedia(doc, cmd.owner, current.filter((_, i) => i !== cmd.index)) };
		}
		case 'updateMeta':
			return {
				ok: true,
				doc: stamp({
					...doc,
					title: cmd.patch.title ?? doc.title,
					description: cmd.patch.description ?? doc.description,
					ruleset: cmd.patch.ruleset ?? doc.ruleset,
					startingSide: cmd.patch.startingSide ?? doc.startingSide,
					position: 'position' in cmd.patch ? (cmd.patch.position ?? null) : doc.position,
				}),
			};
		default: {
			const unreachable: never = cmd;
			return refuse(`Unknown command ${JSON.stringify(unreachable)}`);
		}
	}
}
