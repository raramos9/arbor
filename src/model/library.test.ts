import { describe, expect, it } from 'vitest';
import libraryData from './library.json';
import { LIBRARY, parseLibrary, searchLibrary, type LibraryTechnique } from './library';

function entry(overrides: Record<string, unknown>) {
	return {
		id: 'x',
		kind: 'technique',
		name: 'X',
		aliases: [],
		description: '',
		media: [],
		tags: [],
		source: 'test',
		...overrides,
	};
}

function library(...inputs: Record<string, unknown>[]): LibraryTechnique[] {
	const parsed = parseLibrary(inputs.map(entry));
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
}

describe('seed library', () => {
	it('parses', () => {
		expect(parseLibrary(libraryData).ok).toBe(true);
		expect(LIBRARY.length).toBeGreaterThanOrEqual(30);
	});
	it('has unique ids', () => {
		expect(new Set(LIBRARY.map((t) => t.id)).size).toBe(LIBRARY.length);
	});
});

describe('parseLibrary', () => {
	it('rejects a duplicate id', () => {
		const result = parseLibrary([entry({ id: 'a' }), entry({ id: 'a', name: 'Y' })]);
		expect(result.ok).toBe(false);
	});
	it('rejects a clip media item', () => {
		const clip = { provider: 'clip', title: 't', clipId: 'c', mimeType: 'video/mp4', durationSeconds: null, sizeBytes: 1 };
		expect(parseLibrary([entry({ media: [clip] })]).ok).toBe(false);
	});
	it('accepts a link media item', () => {
		const web = { provider: 'web', title: 't', url: 'https://example.com' };
		expect(parseLibrary([entry({ media: [web] })]).ok).toBe(true);
	});
});

describe('searchLibrary', () => {
	const lib = library(
		{ id: 'triangle', kind: 'submission', name: 'Triangle choke', aliases: ['Sankaku'], tags: ['choke'] },
		{ id: 'mount', kind: 'position', name: 'Mount', tags: ['pin'] },
		{ id: 'armbar', kind: 'submission', name: 'Armbar', tags: ['joint-lock'] },
		{ id: 'sweep', kind: 'technique', name: 'Scissor sweep', tags: ['sweep'] },
	);
	const ids = (query: string) => searchLibrary(lib, query).map((t) => t.id);

	it('matches name', () => expect(ids('mount')).toEqual(['mount']));
	it('matches alias', () => expect(ids('sankaku')).toEqual(['triangle']));
	it('matches tag', () => expect(ids('joint')).toEqual(['armbar']));
	it('is case-insensitive', () => expect(ids('TRIANGLE')).toEqual(['triangle']));
	it('returns everything for an empty or blank query', () => {
		expect(ids('')).toHaveLength(4);
		expect(ids('   ')).toHaveLength(4);
	});
	it('orders by kind then name', () => {
		expect(ids('')).toEqual(['mount', 'sweep', 'armbar', 'triangle']);
	});
	it('does not mutate the library', () => {
		const before = lib.map((t) => t.id);
		searchLibrary(lib, '');
		expect(lib.map((t) => t.id)).toEqual(before);
	});
});
