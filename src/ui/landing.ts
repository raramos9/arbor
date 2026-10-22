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
				{ name: 'Cross collar choke' },
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

type Slot = { x: number; y: number; w: number };
type HeroFrame = {
	width: number;
	height: number;
	flow: Graph['flow'];
	root: Slot;
	heads: [Slot, Slot, Slot];
	yoursWidth: number;
	leafOffsets: number[];
	leafX: number | null;
	leafWidth: number;
	labelGap: number;
};

// Units are roughly CSS pixels at the size each frame is drawn; the wide frame sits beside the headline, the tall one under it on phones.
const FRAMES: Record<'wide' | 'tall', HeroFrame> = {
	wide: {
		width: 815,
		height: 700,
		flow: 'right',
		root: { x: 95, y: 350, w: 190 },
		heads: [
			{ x: 372, y: 100, w: 184 },
			{ x: 372, y: 350, w: 184 },
			{ x: 390, y: 600, w: 220 },
		],
		yoursWidth: 220,
		leafOffsets: [-66, 66],
		leafX: 712,
		leafWidth: 196,
		labelGap: 48,
	},
	tall: {
		width: 372,
		height: 400,
		flow: 'down',
		root: { x: 186, y: 34, w: 190 },
		heads: [
			{ x: 64, y: 180, w: 116 },
			{ x: 186, y: 180, w: 116 },
			{ x: 308, y: 180, w: 116 },
		],
		yoursWidth: 116,
		leafOffsets: [140],
		leafX: null,
		leafWidth: 116,
		labelGap: 40,
	},
};

const HERO_LANES: { label: string; doc: StrategyDoc | null }[] = [
	{ label: 'Example plan A', doc: EXAMPLE_A },
	{ label: 'Example plan B', doc: EXAMPLE_B },
	{ label: 'Your plan', doc: null },
];

export const HERO_FALLBACK = 'Closed guard';

export function heroStart(typed: string): { name: string; side: Side } {
	const plan = planFromTyped(typed);
	if (!plan.position) return { name: HERO_FALLBACK, side: 'bottom' };
	return { name: positionName(plan.position), side: plan.startingSide };
}

// "Closed guard" reads as "closed guard" mid-sentence, but a name written in title case ("De La Riva") keeps its capitals.
export function inSentence(name: string): string {
	const words = name.split(' ');
	if (words.length > 1 && words.every((word) => /^[A-Z]/.test(word))) return name;
	return name.charAt(0).toLowerCase() + name.slice(1);
}

// The hero merges several example plans under one shared root; each lane is drawn from its doc so it says what the doc says.
export function heroGraph(frameName: 'wide' | 'tall', typed: string): Graph {
	const frame = FRAMES[frameName];
	const start = heroStart(typed);
	const nodes: GraphNode[] = [
		{ id: 'root', name: start.name, meta: start.side, ...frame.root, tone: 'start', end: false, beat: 0 },
	];
	const edges: GraphEdge[] = [];
	const lanes: GraphLane[] = [];
	HERO_LANES.forEach((lane, index) => {
		const slot = frame.heads[index]!;
		const yours = lane.doc === null;
		const width = yours ? frame.yoursWidth : slot.w;
		lanes.push({
			id: `lane-${index}`,
			text: lane.label,
			x: frame.flow === 'right' ? slot.x - width / 2 : slot.x,
			y: slot.y - frame.labelGap,
			yours,
			beat: yours ? 3 : 1,
		});
		if (lane.doc === null) {
			nodes.push({ id: 'yours', name: 'Your first move', ...slot, w: width, tone: 'yours', end: false, beat: 4 });
			edges.push({ id: 'root-yours', from: 'root', to: 'yours', pill: null, dashed: false, yours: true, beat: 3 });
			return;
		}
		const head = toOutline(lane.doc).start.next.find((entry): entry is OutlineStep => entry.kind === 'step');
		if (!head) return;
		const leaves = head.next.filter((entry): entry is OutlineStep => entry.kind === 'step').slice(0, frame.leafOffsets.length);
		nodes.push({ id: head.node, name: head.name, ...slot, tone: 'step', end: leaves.length === 0, beat: 1 });
		edges.push(graphEdge('root', head, 1));
		leaves.forEach((leaf, leafIndex) => {
			const offset = frame.leafOffsets[leafIndex]!;
			nodes.push({ id: leaf.node, name: leaf.name, x: frame.leafX ?? slot.x, y: slot.y + offset, w: frame.leafWidth, tone: 'step', end: leaf.next.length === 0, beat: 2 });
			edges.push(graphEdge(head.node, leaf, 2));
		});
	});
	return { width: frame.width, height: frame.height, flow: frame.flow, nodes, edges, lanes };
}

function graphEdge(from: string, to: OutlineStep, beat: number): GraphEdge {
	const reaction = to.reaction.trim();
	return { id: to.edge ?? to.node, from, to: to.node, pill: reactionPhrase(reaction), dashed: reaction === '', yours: false, beat };
}
