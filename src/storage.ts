import { parseLibrary, type LibraryTechnique } from './model/library';
import { parseStrategy, type Result, type StrategyDoc } from './model/strategy';

const PREFIX = 'arbor.strategy.';
const LIBRARY_KEY = 'arbor.library';

export type StoredStrategy =
	| { ok: true; id: string; doc: StrategyDoc }
	| { ok: false; id: string; error: string };

function describe(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

export function listStrategies(): StoredStrategy[] {
	const ids: string[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
		}
	} catch {
		return [];
	}
	return ids.map((id): StoredStrategy => {
		const loaded = loadStrategy(id);
		return loaded.ok ? { ok: true, id, doc: loaded.value } : { ok: false, id, error: loaded.error };
	});
}

export function hasStrategy(id: string): boolean {
	try {
		return localStorage.getItem(PREFIX + id) !== null;
	} catch {
		return false;
	}
}

export function loadStrategy(id: string): Result<StrategyDoc> {
	let raw: string | null;
	try {
		raw = localStorage.getItem(PREFIX + id);
	} catch (e) {
		return { ok: false, error: `Storage is unavailable: ${describe(e)}` };
	}
	if (raw === null) return { ok: false, error: 'No strategy with that id exists in this browser.' };
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch (e) {
		return { ok: false, error: `Stored data is not valid JSON: ${describe(e)}` };
	}
	const parsed = parseStrategy(json);
	return parsed.ok ? parsed : { ok: false, error: `Stored data is corrupt: ${parsed.error}` };
}

export function saveStrategy(doc: StrategyDoc): Result<null> {
	try {
		localStorage.setItem(PREFIX + doc.id, JSON.stringify(doc));
		return { ok: true, value: null };
	} catch (e) {
		return { ok: false, error: `Could not save: ${describe(e)}` };
	}
}

export function loadMyLibrary(): Result<LibraryTechnique[]> {
	let raw: string | null;
	try {
		raw = localStorage.getItem(LIBRARY_KEY);
	} catch (e) {
		return { ok: false, error: `Storage is unavailable: ${describe(e)}` };
	}
	if (raw === null) return { ok: true, value: [] };
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch (e) {
		return { ok: false, error: `Your library is not valid JSON: ${describe(e)}` };
	}
	const parsed = parseLibrary(json);
	return parsed.ok ? parsed : { ok: false, error: `Your library is corrupt: ${parsed.error}` };
}

export function saveMyLibrary(list: readonly LibraryTechnique[]): Result<null> {
	try {
		localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
		return { ok: true, value: null };
	} catch (e) {
		return { ok: false, error: `Could not save: ${describe(e)}` };
	}
}
