import { z } from 'zod';
import { ClipIdSchema, type ClipId, type Result } from './model/strategy';

const DB_NAME = 'arbor';
const STORE = 'clips';

const StoredClipSchema = z.object({
	id: ClipIdSchema,
	blob: z.instanceof(Blob),
	poster: z.instanceof(Blob).nullable(),
	createdAt: z.string(),
});

export type StoredClip = z.infer<typeof StoredClipSchema>;

let connection: IDBDatabase | null = null;
let persistRequested = false;

function describe(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function fail<T>(action: string, e: unknown): Result<T> {
	return { ok: false, error: `Could not ${action}: ${describe(e)}` };
}

function openDb(): Promise<IDBDatabase> {
	if (connection) return Promise.resolve(connection);
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(STORE, { keyPath: 'id' });
		};
		request.onsuccess = () => {
			const db = request.result;
			db.onclose = () => {
				connection = null;
			};
			db.onversionchange = () => {
				db.close();
				connection = null;
			};
			connection = db;
			resolve(db);
		};
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error('The clip database is blocked by another tab.'));
	});
}

async function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const req = run(tx.objectStore(STORE));
		tx.oncomplete = () => resolve(req.result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('The transaction was aborted.'));
	});
}

function requestPersistence() {
	if (persistRequested) return;
	persistRequested = true;
	void navigator.storage?.persist?.().catch(() => false);
}

export async function saveClip(clip: StoredClip): Promise<Result<null>> {
	try {
		await request('readwrite', (store) => store.put(clip));
	} catch (e) {
		return fail('save the clip', e);
	}
	requestPersistence();
	return { ok: true, value: null };
}

export async function getClip(id: ClipId): Promise<Result<StoredClip | null>> {
	let raw: unknown;
	try {
		raw = await request('readonly', (store) => store.get(id));
	} catch (e) {
		return fail('read the clip', e);
	}
	if (raw === undefined) return { ok: true, value: null };
	const parsed = StoredClipSchema.safeParse(raw);
	if (!parsed.success) return { ok: false, error: 'The stored clip is corrupt.' };
	return { ok: true, value: parsed.data };
}

export async function deleteClip(id: ClipId): Promise<Result<null>> {
	try {
		await request('readwrite', (store) => store.delete(id));
	} catch (e) {
		return fail('delete the clip', e);
	}
	return { ok: true, value: null };
}

export async function listClipIds(): Promise<Result<ClipId[]>> {
	let keys: IDBValidKey[];
	try {
		keys = await request('readonly', (store) => store.getAllKeys());
	} catch (e) {
		return fail('list clips', e);
	}
	const ids: ClipId[] = [];
	for (const key of keys) {
		const parsed = ClipIdSchema.safeParse(key);
		if (parsed.success) ids.push(parsed.data);
	}
	return { ok: true, value: ids };
}
