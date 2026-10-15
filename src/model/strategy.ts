import { z } from 'zod';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const StrategyIdSchema = z.string().min(1).brand('StrategyId');
export const NodeIdSchema = z.string().min(1).brand('NodeId');
export const EdgeIdSchema = z.string().min(1).brand('EdgeId');
export const ClipIdSchema = z.string().min(1).brand('ClipId');
export const LibraryTechniqueIdSchema = z.string().min(1).brand('LibraryTechniqueId');
export const ReactionSchema = z.string().trim().min(1).brand('Reaction');

export const RulesetSchema = z.enum(['gi', 'no-gi', 'both']);
export const SideSchema = z.enum(['top', 'bottom', 'standing']);
export const NodeKindSchema = z.enum(['position', 'technique', 'submission']);

const HttpUrlSchema = z.string().refine((value) => {
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}, 'Links must start with http:// or https://');

export const LinkMediaSchema = z.discriminatedUnion('provider', [
	z.object({
		provider: z.literal('youtube'),
		title: z.string(),
		url: HttpUrlSchema,
		videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
		startSeconds: z.number().nullable(),
	}),
	z.object({ provider: z.literal('instagram'), title: z.string(), url: HttpUrlSchema }),
	z.object({ provider: z.literal('web'), title: z.string(), url: HttpUrlSchema }),
]);

export const MediaSchema = z.discriminatedUnion('provider', [
	...LinkMediaSchema.options,
	z.object({
		provider: z.literal('clip'),
		title: z.string(),
		clipId: ClipIdSchema,
		mimeType: z.string(),
		durationSeconds: z.number().nullable(),
		sizeBytes: z.number(),
	}),
]);

export const StrategyNodeSchema = z.object({
	id: NodeIdSchema,
	kind: NodeKindSchema,
	name: z.string(),
	notes: z.string(),
	media: z.array(MediaSchema),
	libraryId: LibraryTechniqueIdSchema.nullable(),
});

const EdgeBase = z.object({
	id: EdgeIdSchema,
	from: NodeIdSchema,
	to: NodeIdSchema,
	notes: z.string(),
	media: z.array(MediaSchema),
});

export const StrategyEdgeSchema = z.discriminatedUnion('actor', [
	EdgeBase.extend({ actor: z.literal('me'), label: z.string() }),
	EdgeBase.extend({ actor: z.literal('opponent'), label: ReactionSchema }),
]);

export const StrategyDocSchema = z.object({
	schemaVersion: z.literal(1),
	id: StrategyIdSchema,
	title: z.string(),
	description: z.string(),
	ruleset: RulesetSchema,
	startingSide: SideSchema,
	rootNodeId: NodeIdSchema,
	nodes: z.record(z.string(), StrategyNodeSchema),
	edges: z.record(z.string(), StrategyEdgeSchema),
	layout: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type StrategyId = z.infer<typeof StrategyIdSchema>;
export type NodeId = z.infer<typeof NodeIdSchema>;
export type EdgeId = z.infer<typeof EdgeIdSchema>;
export type ClipId = z.infer<typeof ClipIdSchema>;
export type LibraryTechniqueId = z.infer<typeof LibraryTechniqueIdSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;
export type Ruleset = z.infer<typeof RulesetSchema>;
export type Side = z.infer<typeof SideSchema>;
export type NodeKind = z.infer<typeof NodeKindSchema>;
export type LinkMedia = z.infer<typeof LinkMediaSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type StrategyNode = z.infer<typeof StrategyNodeSchema>;
export type StrategyEdge = z.infer<typeof StrategyEdgeSchema>;
export type StrategyDoc = z.infer<typeof StrategyDocSchema>;

export const newNodeId = (): NodeId => NodeIdSchema.parse(crypto.randomUUID());
export const newEdgeId = (): EdgeId => EdgeIdSchema.parse(crypto.randomUUID());
export const newClipId = (): ClipId => ClipIdSchema.parse(crypto.randomUUID());
export const newStrategyId = (): StrategyId => StrategyIdSchema.parse(crypto.randomUUID());

export function parseReaction(label: string): Reaction | null {
	const parsed = ReactionSchema.safeParse(label);
	return parsed.success ? parsed.data : null;
}

function describeIssues(error: z.ZodError): string {
	return error.issues.map((i) => `${i.path.join('.') || 'document'}: ${i.message}`).join('; ');
}

function checkInvariants(doc: StrategyDoc): string | null {
	for (const [key, node] of Object.entries(doc.nodes)) {
		if (key !== node.id) return `node stored under key ${key} has id ${node.id}`;
	}
	for (const [key, edge] of Object.entries(doc.edges)) {
		if (key !== edge.id) return `edge stored under key ${key} has id ${edge.id}`;
	}
	const root = doc.nodes[doc.rootNodeId];
	if (!root) return `root node ${doc.rootNodeId} does not exist`;
	if (root.kind !== 'position') return 'root node must be a position';
	for (const edge of Object.values(doc.edges)) {
		if (!doc.nodes[edge.from]) return `edge ${edge.id} starts at unknown node ${edge.from}`;
		if (!doc.nodes[edge.to]) return `edge ${edge.id} ends at unknown node ${edge.to}`;
		if (edge.from === edge.to) return `edge ${edge.id} connects a node to itself`;
	}
	return null;
}

export function parseStrategy(input: unknown): Result<StrategyDoc> {
	const parsed = StrategyDocSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: describeIssues(parsed.error) };
	const violation = checkInvariants(parsed.data);
	if (violation) return { ok: false, error: violation };
	return { ok: true, value: parsed.data };
}

export function createStrategy(args: {
	title: string;
	ruleset: Ruleset;
	startingSide: Side;
	rootName: string;
}): StrategyDoc {
	const rootId = newNodeId();
	const now = new Date().toISOString();
	return {
		schemaVersion: 1,
		id: newStrategyId(),
		title: args.title,
		description: '',
		ruleset: args.ruleset,
		startingSide: args.startingSide,
		rootNodeId: rootId,
		nodes: {
			[rootId]: {
				id: rootId,
				kind: 'position',
				name: args.rootName,
				notes: '',
				media: [],
				libraryId: null,
			},
		},
		edges: {},
		layout: {},
		createdAt: now,
		updatedAt: now,
	};
}
