import { describe, expect, it } from 'vitest';
import { armDragDoc, armDragInput } from './fixtures';
import { createStrategy, parseStrategy } from './strategy';

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

	it('rejects a non-position root', () => {
		const input = structuredClone(armDragInput);
		input.rootNodeId = 'arm-drag';
		const result = parseStrategy(input);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('position');
	});

	it('rejects a missing root', () => {
		const input = structuredClone(armDragInput);
		input.rootNodeId = 'ghost';
		expect(parseStrategy(input).ok).toBe(false);
	});

	it('rejects an empty or blank opponent label', () => {
		for (const label of ['', '   ']) {
			const input = structuredClone(armDragInput);
			input.edges.e2.label = label;
			expect(parseStrategy(input).ok).toBe(false);
		}
	});

	it('rejects an unknown schemaVersion', () => {
		expect(parseStrategy({ ...armDragInput, schemaVersion: 2 }).ok).toBe(false);
	});

	it('rejects non-objects', () => {
		expect(parseStrategy(null).ok).toBe(false);
		expect(parseStrategy('x').ok).toBe(false);
	});
});

describe('createStrategy', () => {
	it('creates a valid doc with a position root', () => {
		const doc = createStrategy({ title: 'T', ruleset: 'gi', startingSide: 'top', rootName: 'Closed guard' });
		expect(parseStrategy(doc).ok).toBe(true);
		expect(doc.nodes[doc.rootNodeId]?.kind).toBe('position');
		expect(doc.nodes[doc.rootNodeId]?.name).toBe('Closed guard');
	});

	it('round-trips through JSON', () => {
		expect(parseStrategy(JSON.parse(JSON.stringify(armDragDoc()))).ok).toBe(true);
	});
});
