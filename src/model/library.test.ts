import { describe, expect, it } from 'vitest';
import libraryData from './library.json';
import {
	LIBRARY,
	addTechnique,
	draftToFields,
	parseLibrary,
	removeTechnique,
	searchLibrary,
	updateTechnique,
	type LibraryTechnique,
	type TechniqueDraft,
} from './library';
import { LibraryTechniqueIdSchema } from './strategy';

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

const tid = (s: string) => LibraryTechniqueIdSchema.parse(s);

function draft(overrides: Partial<TechniqueDraft> = {}): TechniqueDraft {
	return { kind: 'technique', name: 'Knee cut', description: '', aliases: '', tags: '', media: [], ...overrides };
}

function mustAdd(all: LibraryTechnique[], mine: LibraryTechnique[], d: TechniqueDraft, id: string) {
	const result = addTechnique(all, mine, d, tid(id));
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

describe('draftToFields', () => {
	it('trims name and description', () => {
		const result = draftToFields(draft({ name: '  Knee cut ', description: '  pass  ' }));
		expect(result.ok && [result.value.name, result.value.description]).toEqual(['Knee cut', 'pass']);
	});
	it('splits, trims and drops empty aliases and tags', () => {
		const result = draftToFields(draft({ aliases: ' Knee slice, ,Knee  ', tags: 'a,,  b ' }));
		expect(result.ok && [result.value.aliases, result.value.tags]).toEqual([['Knee slice', 'Knee'], ['a', 'b']]);
	});
	it('dedupes case-insensitively and lowercases tags', () => {
		const result = draftToFields(draft({ aliases: 'Slice, slice, SLICE', tags: 'Pass, pass, GI' }));
		expect(result.ok && [result.value.aliases, result.value.tags]).toEqual([['Slice'], ['pass', 'gi']]);
	});
	it('refuses an empty name', () => {
		expect(draftToFields(draft({ name: '   ' })).ok).toBe(false);
	});
});

describe('addTechnique', () => {
	const seed = library({ id: 'mount', kind: 'position', name: 'Mount' });

	it('adds an entry with a fresh id and the user source', () => {
		const { mine, technique } = mustAdd(seed, [], draft(), 'mine-1');
		expect(mine).toEqual([technique]);
		expect(technique).toMatchObject({ id: 'mine-1', name: 'Knee cut', source: 'Added by you' });
	});
	it('refuses a duplicate of a seed entry, ignoring case and spacing', () => {
		const result = addTechnique(seed, [], draft({ kind: 'position', name: ' MOUNT ' }), tid('n'));
		expect(!result.ok && result.error).toContain('Mount');
	});
	it('refuses a duplicate of one of mine', () => {
		const { mine } = mustAdd(seed, [], draft(), 'a');
		const result = addTechnique([...seed, ...mine], mine, draft({ name: 'knee cut' }), tid('b'));
		expect(result.ok).toBe(false);
	});
	it('allows the same name with a different kind', () => {
		expect(addTechnique(seed, [], draft({ kind: 'submission', name: 'Mount' }), tid('n')).ok).toBe(true);
	});
	it('refuses an empty name', () => {
		expect(addTechnique(seed, [], draft({ name: '' }), tid('n')).ok).toBe(false);
	});
});

describe('updateTechnique', () => {
	const seed = library({ id: 'mount', kind: 'position', name: 'Mount' });
	const { mine } = mustAdd(seed, [], draft(), 'a');
	const all = [...seed, ...mine];

	it('refuses a seed id', () => {
		expect(updateTechnique(all, mine, tid('mount'), draft({ kind: 'position', name: 'Mount 2' })).ok).toBe(false);
	});
	it('allows keeping its own name', () => {
		const result = updateTechnique(all, mine, tid('a'), draft({ description: 'new' }));
		expect(result.ok && result.value[0]).toMatchObject({ id: 'a', name: 'Knee cut', description: 'new' });
	});
	it('refuses a rename onto another entry', () => {
		expect(updateTechnique(all, mine, tid('a'), draft({ kind: 'position', name: 'mount' })).ok).toBe(false);
	});
});

describe('removeTechnique', () => {
	it('removes only the given id', () => {
		const seed = library({ id: 'mount', kind: 'position', name: 'Mount' });
		const first = mustAdd(seed, [], draft(), 'a');
		const second = mustAdd(seed, first.mine, draft({ name: 'Other' }), 'b');
		expect(removeTechnique(second.mine, tid('a')).map((t) => t.id)).toEqual(['b']);
		expect(removeTechnique(second.mine, tid('zzz'))).toHaveLength(2);
	});
});
