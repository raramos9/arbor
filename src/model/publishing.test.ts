import { describe, expect, it, vi } from 'vitest';
import { armDragDoc, armDragInput } from './fixtures';
import {
	PAGE_SIZE,
	forkPublished,
	hasChanges,
	parseHandle,
	parsePublished,
	prepareForPublish,
	toSummaryPage,
} from './publishing';
import {
	ClipIdSchema,
	EdgeIdSchema,
	HandleSchema,
	NodeIdSchema,
	PublishedIdSchema,
	parseStrategy,
	type Media,
	type StrategyDoc,
} from './strategy';

const publishedId = '11111111-1111-4111-8111-111111111111';
const parentId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

const clip = (id: string): Media => ({
	provider: 'clip',
	title: id,
	clipId: ClipIdSchema.parse(id),
	mimeType: 'video/mp4',
	durationSeconds: null,
	sizeBytes: 3,
});
const youtube: Media = {
	provider: 'youtube',
	title: 'Tutorial',
	url: 'https://youtu.be/dQw4w9WgXcQ',
	videoId: 'dQw4w9WgXcQ',
	startSeconds: 12,
};
const web: Media = { provider: 'web', title: 'Notes', url: 'https://example.com/notes' };
const instagram: Media = { provider: 'instagram', title: 'Reel', url: 'https://instagram.com/reel/x' };

function mixedDoc(): StrategyDoc {
	const doc = armDragDoc();
	const node = doc.nodes[NodeIdSchema.parse('arm-drag')];
	const edge = doc.edges[EdgeIdSchema.parse('e2')];
	if (!node || !edge) throw new Error('fixture changed');
	node.media = [youtube, clip('a'), web];
	edge.media = [clip('b'), instagram, clip('c')];
	return doc;
}

describe('prepareForPublish', () => {
	it('strips clips from nodes and edges and counts them', () => {
		const result = prepareForPublish(mixedDoc());
		expect(result.strippedClips).toBe(3);
		const all = [...Object.values(result.doc.nodes), ...Object.values(result.doc.edges)].flatMap((x) => x.media);
		expect(all.some((m) => m.provider === 'clip')).toBe(false);
	});

	it('keeps links in order', () => {
		const { doc } = prepareForPublish(mixedDoc());
		expect(doc.nodes[NodeIdSchema.parse('arm-drag')]?.media).toEqual([youtube, web]);
		expect(doc.edges[EdgeIdSchema.parse('e2')]?.media).toEqual([instagram]);
	});

	it('does not mutate the input', () => {
		const input = mixedDoc();
		const before = structuredClone(input);
		prepareForPublish(input);
		expect(input).toEqual(before);
	});

	it('returns an equal doc and zero when there are no clips', () => {
		const input = armDragDoc();
		const result = prepareForPublish(input);
		expect(result.strippedClips).toBe(0);
		expect(result.doc).toEqual(input);
	});
});

const origin = { publishedId: PublishedIdSchema.parse(parentId), title: 'Original', handle: HandleSchema.parse('bo-lee') };

describe('position', () => {
	it('prepareForPublish keeps the position', () => {
		const position = { kind: 'listed', id: 'half-guard' } as const;
		expect(prepareForPublish({ ...armDragDoc(), position }).doc.position).toEqual(position);
	});
});

describe('forks', () => {
	it('prepareForPublish nulls origin', () => {
		expect(prepareForPublish({ ...armDragDoc(), origin }).doc.origin).toBeNull();
	});

	it('hasChanges ignores origin on a fork', () => {
		expect(hasChanges({ ...armDragDoc(), origin }, armDragDoc())).toBe(false);
	});

	it('forkPublished copies content under a new id with origin and timestamps', () => {
		const parsed = parsePublished(row());
		if (!parsed.ok) throw new Error(parsed.error);
		const source = parsed.value;
		const fork = forkPublished(source, '2026-11-01T00:00:00Z');
		expect(fork.id).not.toBe(source.doc.id);
		expect(fork.origin).toEqual({ publishedId: publishedId, title: source.doc.title, handle: 'ana-silva' });
		expect(fork.createdAt).toBe('2026-11-01T00:00:00Z');
		expect(fork.updatedAt).toBe('2026-11-01T00:00:00Z');
		expect(fork.nodes).toEqual(source.doc.nodes);
		expect(fork.edges).toEqual(source.doc.edges);
		expect(fork.layout).toEqual(source.doc.layout);
		expect(fork.rootNodeId).toBe(source.doc.rootNodeId);
		expect(fork.title).toBe(source.doc.title);
		expect(fork.ruleset).toBe(source.doc.ruleset);
	});
});

const row = (overrides: Record<string, unknown> = {}) => ({
	id: publishedId,
	doc: structuredClone(armDragInput),
	parent: null,
	published_at: '2026-10-16T00:00:00Z',
	updated_at: '2026-10-17T00:00:00Z',
	owner: { id: userId, handle: 'ana-silva' },
	...overrides,
});

function failure(input: unknown): string {
	const result = parsePublished(input);
	if (result.ok) throw new Error('expected failure');
	return result.error;
}

describe('parsePublished', () => {
	it('accepts a valid row and maps fields', () => {
		const result = parsePublished(row());
		if (!result.ok) throw new Error(result.error);
		expect(result.value).toEqual({
			id: publishedId,
			owner: { id: userId, handle: 'ana-silva' },
			doc: armDragDoc(),
			forkedFrom: null,
			publishedAt: '2026-10-16T00:00:00Z',
			updatedAt: '2026-10-17T00:00:00Z',
		});
	});

	it('maps a fork parent', () => {
		const result = parsePublished(row({ parent: { id: parentId, title: 'Original', owner: { handle: 'bo-lee' } } }));
		expect(result.ok && result.value.forkedFrom).toEqual({ id: parentId, title: 'Original', handle: 'bo-lee' });
	});

	it('maps a null parent title to an empty string', () => {
		const result = parsePublished(row({ parent: { id: parentId, title: null, owner: { handle: 'bo-lee' } } }));
		expect(result.ok && result.value.forkedFrom?.title).toBe('');
	});

	it('rejects a parent with a bad handle', () => {
		expect(failure(row({ parent: { id: parentId, title: 'x', owner: { handle: 'Bad Handle' } } }))).toContain(
			'parent.owner.handle',
		);
	});

	it('rejects an edge pointing at an unknown node', () => {
		const doc = structuredClone(armDragInput);
		doc.edges.e1.to = 'ghost';
		const error = failure(row({ doc }));
		expect(error.startsWith('doc:')).toBe(true);
		expect(error).toContain('unknown node ghost');
	});

	it('rejects a doc missing its title', () => {
		const { title: _title, ...doc } = armDragInput;
		const error = failure(row({ doc }));
		expect(error.startsWith('doc:')).toBe(true);
		expect(error).toContain('title');
	});

	it('rejects a null handle', () => {
		expect(failure(row({ owner: { id: userId, handle: null } }))).toContain('owner.handle');
	});

	it('rejects a malformed handle', () => {
		expect(failure(row({ owner: { id: userId, handle: 'Bad Handle' } }))).toContain('owner.handle');
	});

	it('rejects a bad id', () => {
		expect(failure(row({ id: 'not-a-uuid' }))).toContain('id:');
	});

	it('rejects a non-object row', () => {
		expect(failure('nope')).toContain('row:');
		expect(failure(null)).toContain('row:');
	});
});

describe('parseHandle', () => {
	it('accepts a valid handle', () => {
		expect(parseHandle('ada-99')).toEqual({ ok: true, value: 'ada-99' });
	});

	it('trims and lowercases', () => {
		expect(parseHandle('  Ada-Lovelace ')).toEqual({ ok: true, value: 'ada-lovelace' });
	});

	it('accepts the length bounds', () => {
		expect(parseHandle('abc').ok).toBe(true);
		expect(parseHandle('a'.repeat(24)).ok).toBe(true);
	});

	it.each([
		['too short', 'ab'],
		['too long', 'a'.repeat(25)],
		['leading dash', '-abc'],
		['trailing dash', 'abc-'],
		['bad characters', 'ab_c'],
		['spaces inside', 'ab c'],
		['empty', ''],
	])('rejects %s', (_name, input) => {
		const result = parseHandle(input);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('3 to 24');
	});
});

describe('hasChanges', () => {
	const reorder = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(reorder);
		if (typeof value !== 'object' || value === null) return value;
		return Object.fromEntries(
			Object.entries(value)
				.reverse()
				.map(([key, inner]) => [key, reorder(inner)]),
		);
	};

	it('is false for identical docs', () => {
		expect(hasChanges(armDragDoc(), armDragDoc())).toBe(false);
	});

	it('ignores object key order', () => {
		const published = parseStrategy(reorder(JSON.parse(JSON.stringify(armDragDoc()))));
		if (!published.ok) throw new Error(published.error);
		expect(hasChanges(armDragDoc(), published.value)).toBe(false);
	});

	it('ignores clips that publishing strips', () => {
		const local = mixedDoc();
		expect(hasChanges(local, prepareForPublish(local).doc)).toBe(false);
	});

	it('detects a renamed node', () => {
		const local = armDragDoc();
		const node = local.nodes[NodeIdSchema.parse('arm-drag')];
		if (!node) throw new Error('fixture changed');
		node.name = 'Renamed';
		expect(hasChanges(local, armDragDoc())).toBe(true);
	});

	it('detects a moved layout', () => {
		const local = armDragDoc();
		local.layout['arm-drag'] = { x: 10, y: 20 };
		expect(hasChanges(local, armDragDoc())).toBe(true);
	});
});

describe('toSummaryPage', () => {
	const row = (i: number, overrides: Record<string, unknown> = {}) => ({
		id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
		title: `Strategy ${i}`,
		ruleset: 'gi',
		starting_side: 'top',
		updated_at: `2026-01-01T00:00:${String(59 - (i % 60)).padStart(2, '0')}.000Z`,
		owner: { handle: 'alice' },
		...overrides,
	});
	const rows = (count: number) => Array.from({ length: count }, (_, i) => row(i));

	it('has no next page when fewer than a page and one extra arrive', () => {
		const page = toSummaryPage(rows(PAGE_SIZE));
		expect(page.items).toHaveLength(PAGE_SIZE);
		expect(page.next).toBeNull();
	});

	it('keeps a page and cursors on its last row when more arrive', () => {
		const all = rows(PAGE_SIZE + 1);
		const page = toSummaryPage(all);
		expect(page.items).toHaveLength(PAGE_SIZE);
		expect(page.next).toEqual({ updatedAt: all[PAGE_SIZE - 1]?.updated_at, id: all[PAGE_SIZE - 1]?.id });
		expect(page.items[0]).toEqual({
			id: all[0]?.id,
			title: 'Strategy 0',
			handle: 'alice',
			ruleset: 'gi',
			startingSide: 'top',
			updatedAt: all[0]?.updated_at,
		});
	});

	it('drops a malformed row but still cursors from the raw last row', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const all = rows(PAGE_SIZE + 1);
		all[PAGE_SIZE - 1] = row(PAGE_SIZE - 1, { ruleset: 'nonsense' });
		const page = toSummaryPage(all);
		expect(page.items).toHaveLength(PAGE_SIZE - 1);
		expect(page.next).toEqual({ updatedAt: all[PAGE_SIZE - 1]?.updated_at, id: all[PAGE_SIZE - 1]?.id });
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('turns a null title into an empty string', () => {
		expect(toSummaryPage([row(1, { title: null })]).items[0]?.title).toBe('');
	});
});
