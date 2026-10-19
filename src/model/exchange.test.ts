import { describe, expect, it } from 'vitest';
import { clipsToSave, exportFileName, parseArborFile, planImport } from './exchange';
import { armDragDoc } from './fixtures';
import { ClipIdSchema, NodeIdSchema, type StrategyDoc } from './strategy';

const keep = ClipIdSchema.parse('keep');
const stray = ClipIdSchema.parse('stray');

function withClip(): StrategyDoc {
	const doc = armDragDoc();
	const node = doc.nodes[NodeIdSchema.parse('arm-drag')];
	if (!node) throw new Error('fixture changed');
	node.media = [{ provider: 'clip', title: '', clipId: keep, mimeType: 'video/mp4', durationSeconds: null, sizeBytes: 3 }];
	return doc;
}

const encoded = { type: 'video/mp4', base64: 'AAEC' };
const clip = (id: string) => ({ id, createdAt: '2026-10-15T00:00:00Z', blob: encoded, poster: null });

function fileText(overrides: Record<string, unknown> = {}, strategy: unknown = withClip()): string {
	return JSON.stringify({ format: 'arbor.strategy', version: 1, strategy, clips: [clip('keep')], ...overrides });
}

function failure(text: string): string {
	const result = parseArborFile(text);
	if (result.ok) throw new Error('expected failure');
	return result.error;
}

describe('parseArborFile', () => {
	it('round-trips a valid file', () => {
		const doc = withClip();
		const result = parseArborFile(fileText());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.strategy).toEqual(doc);
		expect(result.value.clips).toEqual([clip('keep')]);
	});

	it('rejects the wrong format', () => {
		expect(failure(fileText({ format: 'other' }))).toContain('format');
	});

	it('rejects the wrong version', () => {
		expect(failure(fileText({ version: 2 }))).toContain('version');
	});

	it('rejects text that is not JSON', () => {
		expect(failure('not json')).toContain('JSON');
	});

	it('rejects a strategy that fails its invariants', () => {
		const broken = { ...withClip(), rootNodeId: 'missing' };
		expect(failure(fileText({}, broken))).toContain('root node');
	});

	it('drops clips the strategy does not reference', () => {
		const result = parseArborFile(fileText({ clips: [clip('keep'), clip(stray)] }));
		expect(result.ok && result.value.clips.map((c) => c.id)).toEqual([keep]);
	});
});

describe('planImport', () => {
	it('plans a new strategy when nothing is stored', () => {
		expect(planImport(armDragDoc(), null)).toEqual({ kind: 'new' });
	});

	it('plans nothing when the stored strategy is identical', () => {
		expect(planImport(armDragDoc(), { ok: true, value: armDragDoc() })).toEqual({ kind: 'unchanged' });
	});

	it('asks to replace a stored strategy that differs', () => {
		const stored = armDragDoc();
		stored.title = 'Older title';
		expect(planImport(armDragDoc(), { ok: true, value: stored })).toEqual({
			kind: 'replace',
			existingTitle: 'Older title',
		});
	});

	it('asks to replace a stored strategy that cannot be read', () => {
		expect(planImport(armDragDoc(), { ok: false, error: 'corrupt' })).toEqual({
			kind: 'replace',
			existingTitle: null,
		});
	});
});

describe('exportFileName', () => {
	it('slugifies the title', () => {
		expect(exportFileName(armDragDoc())).toBe('arm-drag-from-open-guard.arbor.json');
	});

	it('falls back when the title has no usable characters', () => {
		const doc = armDragDoc();
		doc.title = '  !!! ';
		expect(exportFileName(doc)).toBe('strategy.arbor.json');
	});
});

describe('clipsToSave', () => {
	it('never overwrites a clip that already exists on this device', () => {
		const result = parseArborFile(fileText());
		if (!result.ok) throw new Error(result.error);
		expect(clipsToSave(result.value, [keep])).toEqual([]);
		expect(clipsToSave(result.value, [stray])).toEqual([clip('keep')]);
	});
});
