import { describe, expect, it } from 'vitest';
import { armDragDoc, armDragInput } from './fixtures';
import { parsePublished, prepareForPublish } from './publishing';
import { ClipIdSchema, EdgeIdSchema, NodeIdSchema, type Media, type StrategyDoc } from './strategy';

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

const row = (overrides: Record<string, unknown> = {}) => ({
	id: publishedId,
	doc: structuredClone(armDragInput),
	forked_from: null,
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
		const result = parsePublished(row({ forked_from: parentId }));
		expect(result.ok && result.value.forkedFrom).toBe(parentId);
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
