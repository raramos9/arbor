import { canonicalPosition, positionName, type Position, type PositionId } from '../model/positions';
import {
	EdgeIdSchema,
	NodeIdSchema,
	StrategyIdSchema,
	type NodeId,
	type Ruleset,
	type Side,
	type StrategyDoc,
} from '../model/strategy';
import { reactionPhrase, toOutline, type OutlineStep } from './outline';

export type PlanStart = { title: string; position: Position | null; startingSide: Side };

const SIDE: Record<PositionId, Side> = {
	standing: 'standing',
	'closed-guard': 'bottom',
	'half-guard': 'bottom',
	'butterfly-guard': 'bottom',
	'de-la-riva': 'bottom',
	'spider-guard': 'bottom',
	'x-guard': 'bottom',
	'single-leg-x': 'bottom',
	'side-control': 'top',
	mount: 'top',
	back: 'top',
	turtle: 'top',
	'north-south': 'top',
	'knee-on-belly': 'top',
};

export const POSITION_NAME_LIMIT = 60;

export function planFromTyped(typed: string): PlanStart {
	const name = typed.trim().replace(/\s+/g, ' ').slice(0, POSITION_NAME_LIMIT).trim();
	if (name === '') return { title: 'My game plan', position: null, startingSide: 'bottom' };
	const position = canonicalPosition({ kind: 'other', name });
	return {
		title: `${positionName(position)} game plan`,
		position,
		startingSide: position.kind === 'listed' ? SIDE[position.id] : 'bottom',
	};
}

export type SessionPresence = 'loading' | 'signed-in' | 'signed-out';
export type HomeVisit = 'checking' | 'landing' | 'home';

// Saved strategies decide without waiting on auth, so returning visitors never see the landing page flash.
export function homeVisit(hasSaved: boolean, session: SessionPresence): HomeVisit {
	if (hasSaved) return 'home';
	switch (session) {
		case 'loading':
			return 'checking';
		case 'signed-in':
			return 'home';
		case 'signed-out':
			return 'landing';
		default: {
			const unreachable: never = session;
			throw new Error(String(unreachable));
		}
	}
}

export type Tone = 'start' | 'step' | 'yours';

export type GraphNode = {
	id: string;
	name: string;
	meta?: string;
	x: number;
	y: number;
	w: number;
	tone: Tone;
	end: boolean;
	beat: number;
};

export type GraphEdge = {
	id: string;
	from: string;
	to: string;
	pill: string | null;
	dashed: boolean;
	yours: boolean;
	beat: number;
};

export type GraphLane = { id: string; text: string; x: number; y: number; yours: boolean; beat: number };

export type Graph = {
	width: number;
	height: number;
	flow: 'right' | 'down';
	nodes: GraphNode[];
	edges: GraphEdge[];
	lanes: GraphLane[];
};

const node = (n: Omit<GraphNode, 'end' | 'tone'> & Partial<Pick<GraphNode, 'end' | 'tone'>>): GraphNode => ({
	tone: 'step',
	end: false,
	...n,
});
const edge = (from: string, to: string, pill: string | null, beat: number, extra: Partial<GraphEdge> = {}): GraphEdge => ({
	id: `${from}-${to}`,
	from,
	to,
	pill,
	dashed: pill === 'then',
	yours: false,
	beat,
	...extra,
});

const ROOT_META = 'bottom · gi';

// The hero merges several people's plans under one root, so it is laid out by hand rather than from one doc.
export const HERO_WIDE: Graph = {
	width: 790,
	height: 620,
	flow: 'right',
	nodes: [
		node({ id: 'root', name: 'Closed guard', meta: ROOT_META, x: 112, y: 320, w: 204, tone: 'start', beat: 0 }),
		node({ id: 'a', name: 'Break posture', x: 420, y: 110, w: 170, beat: 1 }),
		node({ id: 'a1', name: 'Scissor sweep', x: 700, y: 52, w: 164, end: true, beat: 2 }),
		node({ id: 'a2', name: 'Cross collar choke', x: 700, y: 168, w: 164, end: true, beat: 2 }),
		node({ id: 'b', name: 'Hip bump', x: 420, y: 320, w: 170, beat: 1 }),
		node({ id: 'b1', name: 'Kimura', x: 700, y: 262, w: 164, end: true, beat: 2 }),
		node({ id: 'b2', name: 'Guillotine', x: 700, y: 378, w: 164, end: true, beat: 2 }),
		node({ id: 'you', name: 'Your first move', x: 420, y: 530, w: 170, tone: 'yours', beat: 4 }),
	],
	edges: [
		edge('root', 'a', null, 1),
		edge('root', 'b', null, 1),
		edge('a', 'a1', 'if he postures', 2),
		edge('a', 'a2', 'then', 2),
		edge('b', 'b1', 'if he posts', 2),
		edge('b', 'b2', 'if he leans in', 2),
		edge('root', 'you', null, 3, { yours: true }),
	],
	lanes: [
		{ id: 'la', text: 'Example plan A', x: 335, y: 72, yours: false, beat: 1 },
		{ id: 'lb', text: 'Example plan B', x: 335, y: 282, yours: false, beat: 1 },
		{ id: 'lc', text: 'Your plan', x: 335, y: 492, yours: true, beat: 3 },
	],
};

export const HERO_TALL: Graph = {
	width: 372,
	height: 372,
	flow: 'down',
	nodes: [
		node({ id: 'root', name: 'Closed guard', meta: ROOT_META, x: 186, y: 34, w: 190, tone: 'start', beat: 0 }),
		node({ id: 'a', name: 'Break posture', x: 64, y: 160, w: 116, beat: 1 }),
		node({ id: 'a1', name: 'Scissor sweep', x: 64, y: 300, w: 116, end: true, beat: 2 }),
		node({ id: 'b', name: 'Hip bump', x: 186, y: 160, w: 116, beat: 1 }),
		node({ id: 'b1', name: 'Kimura', x: 186, y: 300, w: 116, end: true, beat: 2 }),
		node({ id: 'you', name: 'Your first move', x: 308, y: 160, w: 116, tone: 'yours', beat: 4 }),
	],
	edges: [
		edge('root', 'a', null, 1),
		edge('root', 'b', null, 1),
		edge('a', 'a1', 'if he postures', 2),
		edge('b', 'b1', 'if he posts', 2),
		edge('root', 'you', null, 3, { yours: true }),
	],
	lanes: [
		{ id: 'la', text: 'Example plan A', x: 64, y: 122, yours: false, beat: 1 },
		{ id: 'lb', text: 'Example plan B', x: 186, y: 122, yours: false, beat: 1 },
		{ id: 'lc', text: 'Your plan', x: 308, y: 122, yours: true, beat: 3 },
	],
};

type Branch = { name: string; via?: string; next?: Branch[] };

// Examples are real StrategyDocs so the outline, mini tree and preview code render them exactly as they render user plans.
export function exampleDoc(title: string, start: Branch, ruleset: Ruleset = 'gi'): StrategyDoc {
	const prefix = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const nodes: StrategyDoc['nodes'] = {};
	const edges: StrategyDoc['edges'] = {};
	let count = 0;
	function add(branch: Branch): NodeId {
		const id = NodeIdSchema.parse(`${prefix}-n${count++}`);
		nodes[id] = { id, name: branch.name, notes: '', media: [] };
		for (const child of branch.next ?? []) {
			const to = add(child);
			const edgeId = EdgeIdSchema.parse(`${to}-in`);
			edges[edgeId] = { id: edgeId, from: id, to, label: child.via ?? '', notes: '', media: [] };
		}
		return id;
	}
	const rootNodeId = add(start);
	return {
		schemaVersion: 2,
		id: StrategyIdSchema.parse(prefix),
		title,
		description: '',
		ruleset,
		startingSide: 'bottom',
		rootNodeId,
		nodes,
		edges,
		layout: {},
		createdAt: '2026-10-01T00:00:00Z',
		updatedAt: '2026-10-01T00:00:00Z',
		origin: null,
		position: { kind: 'listed', id: 'closed-guard' },
	};
}

export const EXAMPLE_A = exampleDoc('Example plan A', {
	name: 'Closed guard',
	next: [
		{
			name: 'Break posture',
			next: [
				{ name: 'Scissor sweep', via: 'he postures' },
				{ name: 'Cross collar choke', next: [{ name: 'Armbar', via: 'he defends' }] },
			],
		},
	],
});

export const EXAMPLE_B = exampleDoc('Example plan B', {
	name: 'Closed guard',
	next: [
		{
			name: 'Hip bump',
			next: [
				{ name: 'Kimura', via: 'he posts' },
				{ name: 'Guillotine', via: 'he leans in' },
			],
		},
	],
});

export const EXAMPLE_C = exampleDoc(
	'Example plan C',
	{
		name: 'Closed guard',
		next: [
			{
				name: 'Overhook',
				next: [
					{ name: 'Triangle', via: 'he postures', next: [{ name: 'Armbar', via: 'he stacks' }] },
					{ name: 'Omoplata', via: 'he pulls his arm out' },
				],
			},
		],
	},
	'both',
);

export const EXAMPLE_FORK = exampleDoc('Example plan B, forked', {
	name: 'Closed guard',
	next: [
		{
			name: 'Hip bump',
			next: [
				{ name: 'Kimura', via: 'he posts', next: [{ name: 'Armbar', via: 'he locks his hands' }] },
				{ name: 'Guillotine', via: 'he leans in' },
			],
		},
	],
});

export const FORK_ADDED: ReadonlySet<string> = new Set(['Armbar']);

type TreeOptions = { columnGap: number; rowGap: number; nodeWidth: number; pad: number; yours?: ReadonlySet<string> };

// Depth runs down and leaves run across, the way the editor's canvas grows.
export function treeGraph(doc: StrategyDoc, { columnGap, rowGap, nodeWidth, pad, yours }: TreeOptions): Graph {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	let leaves = 0;
	let depthMax = 0;

	function place(step: OutlineStep, depth: number): { id: string; x: number } {
		depthMax = Math.max(depthMax, depth);
		const children = step.next.flatMap((entry) => (entry.kind === 'step' ? [entry] : []));
		const placed = children.map((child) => ({ child, at: place(child, depth + 1) }));
		const x = placed.length > 0 ? (placed[0]!.at.x + placed[placed.length - 1]!.at.x) / 2 : pad + nodeWidth / 2 + leaves++ * columnGap;
		const isYours = yours?.has(step.name) ?? false;
		nodes.push({
			id: step.node,
			name: step.name,
			meta: depth === 0 ? `${doc.startingSide} · ${doc.ruleset === 'both' ? 'gi + no-gi' : doc.ruleset}` : undefined,
			x,
			y: pad + 24 + depth * rowGap,
			w: nodeWidth,
			tone: depth === 0 ? 'start' : isYours ? 'yours' : 'step',
			end: children.length === 0 && !isYours,
			beat: 0,
		});
		for (const { child, at } of placed) {
			edges.push({
				id: child.edge ?? child.node,
				from: step.node,
				to: at.id,
				pill: reactionPhrase(child.reaction.trim()),
				dashed: child.reaction.trim() === '',
				yours: yours?.has(child.name) ?? false,
				beat: 0,
			});
		}
		return { id: step.node, x };
	}

	place(toOutline(doc).start, 0);
	return {
		width: pad * 2 + nodeWidth + (leaves - 1) * columnGap,
		height: pad * 2 + 48 + depthMax * rowGap + 24,
		flow: 'down',
		nodes,
		edges,
		lanes: [],
	};
}
