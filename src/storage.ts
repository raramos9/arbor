import { parseStrategy, type Result, type StrategyDoc } from './model/strategy';

const PREFIX = 'arbor.strategy.';

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

export type SaveFailure = 'full' | 'blocked';

export type SaveResult = { ok: true; value: null } | { ok: false; reason: SaveFailure; error: string };

const SAVE_ERROR: Record<SaveFailure, string> = {
	full: 'Could not save: this browser’s storage for Arbor is full. Delete a plan you no longer need, then try again.',
	blocked: 'Could not save: site storage is blocked or unavailable. Allow site storage for this page, then try again.',
};

// Browsers name a full quota differently: QuotaExceededError (code 22) in most, NS_ERROR_DOM_QUOTA_REACHED (1014) in old Firefox.
export function saveFailure(e: unknown): SaveFailure {
	if (!(e instanceof DOMException)) return 'blocked';
	const full = e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
	return full ? 'full' : 'blocked';
}

export function saveStrategy(doc: StrategyDoc): SaveResult {
	try {
		localStorage.setItem(PREFIX + doc.id, JSON.stringify(doc));
		return { ok: true, value: null };
	} catch (e) {
		const reason = saveFailure(e);
		return { ok: false, reason, error: SAVE_ERROR[reason] };
	}
}
