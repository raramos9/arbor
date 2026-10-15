import {
	parseReaction,
	type EdgeId,
	type NodeId,
	type NodeKind,
	type Reaction,
	type Ruleset,
	type Side,
	type StrategyDoc,
	type StrategyEdge,
	type StrategyNode,
} from './strategy';

export type EdgeActor = StrategyEdge['actor'];

export type Command =
	| { type: 'addNode'; id: NodeId; kind: NodeKind; name: string; at?: { x: number; y: number } }
	| { type: 'updateNode'; id: NodeId; patch: { name?: string; kind?: NodeKind; notes?: string } }
	| { type: 'deleteNode'; id: NodeId }
	| {
			type: 'connect';
			id: EdgeId;
			from: NodeId;
			to: NodeId;
			move: { actor: 'me'; label: string } | { actor: 'opponent'; label: Reaction };
	  }
	| {
			type: 'updateEdge';
			id: EdgeId;
			patch: { actor?: EdgeActor; label?: string; notes?: string };
	  }
	| { type: 'deleteEdge'; id: EdgeId }
	| { type: 'moveNode'; id: NodeId; at: { x: number; y: number } }
	| { type: 'setRoot'; id: NodeId }
	| {
			type: 'updateMeta';
			patch: { title?: string; description?: string; ruleset?: Ruleset; startingSide?: Side };
	  };

export type ApplyResult = { ok: true; doc: StrategyDoc } | { ok: false; reason: string };

const refuse = (reason: string): ApplyResult => ({ ok: false, reason });

export function defaultActor(kind: NodeKind): EdgeActor {
	return kind === 'position' ? 'me' : 'opponent';
}

function omit<V>(record: Record<string, V>, key: string): Record<string, V> {
	return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function stamp(doc: StrategyDoc): StrategyDoc {
	return { ...doc, updatedAt: new Date().toISOString() };
}

export function apply(doc: StrategyDoc, cmd: Command): ApplyResult {
	switch (cmd.type) {
		case 'addNode': {
			if (doc.nodes[cmd.id]) return refuse('A node with that id already exists.');
			const node: StrategyNode = {
				id: cmd.id,
				kind: cmd.kind,
				name: cmd.name,
				notes: '',
				media: [],
				libraryId: null,
			};
			return {
				ok: true,
				doc: stamp({
					...doc,
					nodes: { ...doc.nodes, [cmd.id]: node },
					layout: cmd.at ? { ...doc.layout, [cmd.id]: cmd.at } : doc.layout,
				}),
			};
		}
		case 'updateNode': {
			const node = doc.nodes[cmd.id];
			if (!node) return refuse('That node does not exist.');
			const { kind } = cmd.patch;
			if (kind && kind !== 'position' && cmd.id === doc.rootNodeId) {
				return refuse('The start node must stay a position. Set another position as the start first.');
			}
			const next: StrategyNode = {
				...node,
				name: cmd.patch.name ?? node.name,
				kind: kind ?? node.kind,
				notes: cmd.patch.notes ?? node.notes,
			};
			return { ok: true, doc: stamp({ ...doc, nodes: { ...doc.nodes, [cmd.id]: next } }) };
		}
		case 'deleteNode': {
			if (!doc.nodes[cmd.id]) return refuse('That node does not exist.');
			if (cmd.id === doc.rootNodeId) {
				return refuse('The start node cannot be deleted. Set another position as the start first.');
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
			const base = { id: cmd.id, from: cmd.from, to: cmd.to, notes: '', media: [] };
			let edge: StrategyEdge;
			if (cmd.move.actor === 'opponent') {
				const label = parseReaction(cmd.move.label);
				if (!label) return refuse('An opponent reaction needs a label.');
				edge = { ...base, actor: 'opponent', label };
			} else {
				edge = { ...base, actor: 'me', label: cmd.move.label.trim() };
			}
			return { ok: true, doc: stamp({ ...doc, edges: { ...doc.edges, [cmd.id]: edge } }) };
		}
		case 'updateEdge': {
			const edge = doc.edges[cmd.id];
			if (!edge) return refuse('That edge does not exist.');
			const actor = cmd.patch.actor ?? edge.actor;
			const label = cmd.patch.label ?? edge.label;
			const notes = cmd.patch.notes ?? edge.notes;
			const base = { id: edge.id, from: edge.from, to: edge.to, media: edge.media, notes };
			let next: StrategyEdge;
			if (actor === 'opponent') {
				const reaction = parseReaction(label);
				if (!reaction) return refuse('An opponent reaction needs a label.');
				next = { ...base, actor, label: reaction };
			} else {
				next = { ...base, actor, label: label.trim() };
			}
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
			const node = doc.nodes[cmd.id];
			if (!node) return refuse('That node does not exist.');
			if (node.kind !== 'position') return refuse('Only a position can be the start.');
			return { ok: true, doc: stamp({ ...doc, rootNodeId: cmd.id }) };
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
				}),
			};
		default: {
			const unreachable: never = cmd;
			return refuse(`Unknown command ${JSON.stringify(unreachable)}`);
		}
	}
}
