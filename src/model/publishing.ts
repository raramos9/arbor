import { z } from 'zod';
import { parseStrategy, type LinkMedia, type Media, type Result, type StrategyDoc } from './strategy';

export const PublishedIdSchema = z.string().uuid().brand('PublishedId');
export const UserIdSchema = z.string().uuid().brand('UserId');
export const HandleSchema = z
	.string()
	.regex(/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/)
	.brand('Handle');

export function parseHandle(input: string): Result<Handle> {
	const parsed = HandleSchema.safeParse(input.trim().toLowerCase());
	if (!parsed.success) {
		return { ok: false, error: 'Use 3 to 24 lowercase letters, digits, or dashes, starting and ending with a letter or digit.' };
	}
	return { ok: true, value: parsed.data };
}

export type PublishedId = z.infer<typeof PublishedIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type Handle = z.infer<typeof HandleSchema>;

export const PUBLISHED_COLUMNS = 'id, doc, forked_from, published_at, updated_at, owner:profiles!owner(id, handle)';

export type PublishedStrategy = {
	id: PublishedId;
	owner: { id: UserId; handle: Handle };
	doc: StrategyDoc;
	forkedFrom: PublishedId | null;
	publishedAt: string;
	updatedAt: string;
};

const PublishedRowSchema = z.object({
	id: PublishedIdSchema,
	doc: z.unknown(),
	forked_from: PublishedIdSchema.nullable(),
	published_at: z.string(),
	updated_at: z.string(),
	owner: z.object({ id: UserIdSchema, handle: HandleSchema }),
});

const isLink = (media: Media): media is LinkMedia => media.provider !== 'clip';

export function prepareForPublish(doc: StrategyDoc): { doc: StrategyDoc; strippedClips: number } {
	let strippedClips = 0;
	const links = (media: Media[]): LinkMedia[] => {
		const kept = media.filter(isLink);
		strippedClips += media.length - kept.length;
		return kept;
	};
	const nodes = Object.fromEntries(
		Object.entries(doc.nodes).map(([key, node]) => [key, { ...node, media: links(node.media) }]),
	);
	const edges = Object.fromEntries(
		Object.entries(doc.edges).map(([key, edge]) => [key, { ...edge, media: links(edge.media) }]),
	);
	return { doc: { ...doc, nodes, edges }, strippedClips };
}

function sameJson(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
	}
	const left = Object.entries(a);
	const right = b as Record<string, unknown>;
	return left.length === Object.keys(right).length && left.every(([key, value]) => key in right && sameJson(value, right[key]));
}

export function hasChanges(local: StrategyDoc, published: StrategyDoc): boolean {
	return !sameJson(prepareForPublish(local).doc, published);
}

export function parsePublished(row: unknown): Result<PublishedStrategy> {
	const parsed = PublishedRowSchema.safeParse(row);
	if (!parsed.success) {
		const reason = parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`).join('; ');
		return { ok: false, error: reason };
	}
	const doc = parseStrategy(parsed.data.doc);
	if (!doc.ok) return { ok: false, error: `doc: ${doc.error}` };
	return {
		ok: true,
		value: {
			id: parsed.data.id,
			owner: parsed.data.owner,
			doc: doc.value,
			forkedFrom: parsed.data.forked_from,
			publishedAt: parsed.data.published_at,
			updatedAt: parsed.data.updated_at,
		},
	};
}
