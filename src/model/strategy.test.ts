import { describe, expect, it } from 'vitest';
import { armDragDoc, armDragInput } from './fixtures';
import { createStrategy, EdgeIdSchema, parseStrategy, reactionGroup } from './strategy';

describe('parseStrategy', () => {
	it('accepts the arm-drag example', () => {
		const result = parseStrategy(structuredClone(armDragInput));
		expect(result.ok).toBe(true);
		if (result.ok) expect(Object.keys(result.value.edges)).toHaveLength(3);
	});

	it('rejects a dangling edge', () => {
		const input = structuredClone(armDragInput);
		input.edges.e2.to = 'nowhere';
		const result = parseStrategy(input);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('unknown node');
	});

	it('rejects a stored link that is not http or https', () => {
		const input = structuredClone(armDragInput);
		Object.assign(input.nodes['arm-drag'], {
			media: [{ provider: 'web', title: '', url: 'javascript:alert(1)' }],
		});
		expect(parseStrategy(input).ok).toBe(false);
	});

	it('rejects a stored YouTube id that could change the embed path', () => {
		const input = structuredClone(armDragInput);
		Object.assign(input.nodes['arm-drag'], {
			media: [{ provider: 'youtube', title: '', url: 'https://youtu.be/x', videoId: '../../evil', startSeconds: null }],
		});
		expect(parseStrategy(input).ok).toBe(false);
	});

	it('accepts a stored https link', () => {
		const input = structuredClone(armDragInput);
		Object.assign(input.nodes['arm-drag'], {
			media: [{ provider: 'web', title: '', url: 'https://example.com/arm-drag' }],
		});
		expect(parseStrategy(input).ok).toBe(true);
	});

	it('rejects a self-loop edge', () => {
		const input = structuredClone(armDragInput);
		input.edges.e2.to = 'arm-drag';
		expect(parseStrategy(input).ok).toBe(false);
	});

	it('accepts any node as the root', () => {
		const input = structuredClone(armDragInput);
		input.rootNodeId = 'arm-drag';
		expect(parseStrategy(input).ok).toBe(true);
	});

	it('rejects a missing root', () => {
		const input = structuredClone(armDragInput);
		input.rootNodeId = 'ghost';
		expect(parseStrategy(input).ok).toBe(false);
	});

	it('accepts an empty edge label', () => {
		const input = structuredClone(armDragInput);
		input.edges.e2.label = '';
		expect(parseStrategy(input).ok).toBe(true);
	});

	it('reads a v1 document as v2, keeping labels and dropping retired fields', () => {
		const v1 = {
			...structuredClone(armDragInput),
			schemaVersion: 1,
			nodes: {
				'open-guard': { id: 'open-guard', kind: 'position', name: 'Open guard', notes: '', media: [], libraryId: 'lib-1' },
				'arm-drag': { id: 'arm-drag', kind: 'technique', name: 'Arm drag', notes: '', media: [], libraryId: null },
			},
			edges: {
				e1: { id: 'e1', from: 'open-guard', to: 'arm-drag', actor: 'opponent', label: 'Arm stays displaced', notes: '', media: [] },
			},
		};
		const result = parseStrategy(v1);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.schemaVersion).toBe(2);
		expect(result.value.edges['e1']).toEqual({
			id: 'e1', from: 'open-guard', to: 'arm-drag', label: 'Arm stays displaced', notes: '', media: [],
		});
		expect(result.value.nodes['open-guard']).toEqual({ id: 'open-guard', name: 'Open guard', notes: '', media: [] });
	});

	it('rejects an unknown schemaVersion', () => {
		expect(parseStrategy({ ...armDragInput, schemaVersion: 3 }).ok).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(parseStrategy(null).ok).toBe(false);
		expect(parseStrategy('x').ok).toBe(false);
	});
});

describe('origin', () => {
	const origin = { publishedId: '22222222-2222-4222-8222-222222222222', title: 'Original', handle: 'bo-lee' };

	it('defaults to null when absent', () => {
		const result = parseStrategy(structuredClone(armDragInput));
		expect(result.ok && result.value.origin).toBeNull();
	});

	it('round-trips a valid origin', () => {
		const result = parseStrategy({ ...structuredClone(armDragInput), origin });
		expect(result.ok && result.value.origin).toEqual(origin);
	});

	it('rejects a bad origin handle', () => {
		const result = parseStrategy({ ...structuredClone(armDragInput), origin: { ...origin, handle: 'Bad Handle' } });
		expect(result.ok).toBe(false);
	});
});

describe('createStrategy', () => {
	it('creates a valid doc with a root node', () => {
		const doc = createStrategy({
			title: 'T',
			ruleset: 'gi',
			startingSide: 'top',
			position: { kind: 'listed', id: 'closed-guard' },
		});
		expect(parseStrategy(doc).ok).toBe(true);
		expect(doc.schemaVersion).toBe(2);
		expect(doc.nodes[doc.rootNodeId]?.name).toBe('Closed guard');
		expect(doc.position).toEqual({ kind: 'listed', id: 'closed-guard' });
	});

	it('names the root after a custom position', () => {
		const doc = createStrategy({
			title: 'T',
			ruleset: 'gi',
			startingSide: 'top',
			position: { kind: 'other', name: 'Lasso guard' },
		});
		expect(doc.nodes[doc.rootNodeId]?.name).toBe('Lasso guard');
	});

	it('round-trips through JSON', () => {
		expect(parseStrategy(JSON.parse(JSON.stringify(armDragDoc()))).ok).toBe(true);
	});
});

describe('position', () => {
	const withPosition = (position: unknown) => parseStrategy({ ...structuredClone(armDragInput), position });

	it('defaults to null when absent', () => {
		const result = parseStrategy(structuredClone(armDragInput));
		expect(result.ok && result.value.position).toBeNull();
	});

	it('accepts a listed position', () => {
		const result = withPosition({ kind: 'listed', id: 'half-guard' });
		expect(result.ok && result.value.position).toEqual({ kind: 'listed', id: 'half-guard' });
	});

	it('accepts and trims a custom position', () => {
		const result = withPosition({ kind: 'other', name: '  Lasso guard ' });
		expect(result.ok && result.value.position).toEqual({ kind: 'other', name: 'Lasso guard' });
	});

	it('refuses a blank custom position', () => {
		expect(withPosition({ kind: 'other', name: '   ' }).ok).toBe(false);
	});

	it('refuses an unknown listed id', () => {
		expect(withPosition({ kind: 'listed', id: 'rubber-guard' }).ok).toBe(false);
	});
});

describe('reactionGroup', () => {
	const eid = (id: string) => EdgeIdSchema.parse(id);
	it('finds siblings from the same node with the same words', () => {
		const doc = armDragDoc();
		doc.edges[eid('e3')]!.label = 'if ARM stays displaced ';
		expect(reactionGroup(doc, eid('e2'))).toEqual(['e2', 'e3']);
	});
	it('keeps different reactions and unlabeled connections on their own', () => {
		const doc = armDragDoc();
		expect(reactionGroup(doc, eid('e2'))).toEqual(['e2']);
		expect(reactionGroup(doc, eid('e1'))).toEqual(['e1']);
		expect(reactionGroup(doc, eid('ghost'))).toEqual([]);
	});
});
