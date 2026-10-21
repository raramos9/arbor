import { z } from 'zod';
import {
	HandleSchema,
	PublishedIdSchema,
	newStrategyId,
	parseStrategy,
	type Handle,
	type LinkMedia,
	type Media,
	type PublishedId,
	type Result,
	type StrategyDoc,
} from './strategy';

export const UserIdSchema = z.string().uuid().brand('UserId');

export function parseHandle(input: string): Result<Handle> {
	const parsed = HandleSchema.safeParse(input.trim().toLowerCase());
	if (!parsed.success) {
		return { ok: false, error: 'Use 3 to 24 lowercase letters, digits, or dashes, starting and ending with a letter or digit.' };
	}
	return { ok: true, value: parsed.data };
}

export type UserId = z.infer<typeof UserIdSchema>;

export const PUBLISHED_COLUMNS = 'id, doc, published_at, updated_at, owner:profiles!owner(id, handle), parent:forked_from(id, title, owner:profiles!owner(handle))';

export type PublishedStrategy = {
	id: PublishedId;
	owner: { id: UserId; handle: Handle };
	doc: StrategyDoc;
	forkedFrom: { id: PublishedId; title: string; handle: Handle } | null;
	publishedAt: string;
	updatedAt: string;
};

const PublishedRowSchema = z.object({
	id: PublishedIdSchema,
	doc: z.unknown(),
	published_at: z.string(),
	updated_at: z.string(),
	owner: z.object({ id: UserIdSchema, handle: HandleSchema }),
	parent: z
		.object({
			id: PublishedIdSchema,
			title: z.string().nullable(),
			owner: z.object({ handle: HandleSchema }),
		})
		.nullable(),
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
	return { doc: { ...doc, nodes, edges, origin: null }, strippedClips };
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
	const { parent } = parsed.data;
	return {
		ok: true,
		value: {
			id: parsed.data.id,
			owner: parsed.data.owner,
			doc: doc.value,
			forkedFrom: parent && { id: parent.id, title: parent.title ?? '', handle: parent.owner.handle },
			publishedAt: parsed.data.published_at,
			updatedAt: parsed.data.updated_at,
		},
	};
}

export function forkPublished(published: PublishedStrategy, now: string): StrategyDoc {
	return {
		...published.doc,
		id: newStrategyId(),
		origin: { publishedId: published.id, title: published.doc.title, handle: published.owner.handle },
		createdAt: now,
		updatedAt: now,
	};
}

export const SUMMARY_COLUMNS = 'id, doc, updated_at, owner:profiles!owner(handle)';
export const PAGE_SIZE = 50;

export type PublishedSummary = {
	id: PublishedId;
	handle: Handle;
	updatedAt: string;
	doc: StrategyDoc;
};

export type SummaryCursor = { updatedAt: string; id: PublishedId };
export type SummaryPage = { items: PublishedSummary[]; next: SummaryCursor | null };

const SummaryRowSchema = z.object({
	id: PublishedIdSchema,
	doc: z.unknown(),
	updated_at: z.string(),
	owner: z.object({ handle: HandleSchema }),
});

export function toSummaryPage(rows: unknown[]): SummaryPage {
	const kept = rows.slice(0, PAGE_SIZE);
	const lastKept: unknown = kept[PAGE_SIZE - 1];
	const cursor = z.object({ updated_at: z.string(), id: PublishedIdSchema }).safeParse(lastKept);
	const next = rows.length > PAGE_SIZE && cursor.success ? { updatedAt: cursor.data.updated_at, id: cursor.data.id } : null;
	const items: PublishedSummary[] = [];
	for (const row of kept) {
		const parsed = SummaryRowSchema.safeParse(row);
		if (!parsed.success) {
			const id = (row as { id?: unknown } | null)?.id;
			console.warn(`Skipping malformed published strategy ${String(id)}`);
			continue;
		}
		const { data } = parsed;
		const doc = parseStrategy(data.doc);
		if (!doc.ok) {
			console.warn(`Skipping malformed published strategy ${data.id}`);
			continue;
		}
		items.push({ id: data.id, handle: data.owner.handle, updatedAt: data.updated_at, doc: doc.value });
	}
	return { items, next };
}
