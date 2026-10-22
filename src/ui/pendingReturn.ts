import { z } from 'zod';

// Sign-in leaves the page (Google redirect) or opens a new tab (magic link), and the
// implicit flow clears the hash on return. Remembering where the user was in localStorage
// lets whichever tab gets the session go back there, and resume publishing if that's why they left.
const KEY = 'arbor.pendingReturn';
export const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

export type PendingReturn = { kind: 'publish'; docId: string } | { kind: 'open'; hash: string };

const PendingSchema = z.intersection(
	z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('publish'), docId: z.string().min(1) }),
		z.object({ kind: z.literal('open'), hash: z.string().startsWith('#/') }),
	]),
	z.object({ at: z.number() }),
);

export function encodePending(pending: PendingReturn, now: number): string {
	return JSON.stringify({ ...pending, at: now });
}

export function decodePending(raw: string | null, now: number): PendingReturn | null {
	if (raw === null) return null;
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}
	const parsed = PendingSchema.safeParse(json);
	if (!parsed.success) return null;
	const age = now - parsed.data.at;
	if (age < 0 || age > PENDING_MAX_AGE_MS) return null;
	return parsed.data.kind === 'publish' ? { kind: 'publish', docId: parsed.data.docId } : { kind: 'open', hash: parsed.data.hash };
}

export function rememberPendingReturn(pending: PendingReturn) {
	try {
		localStorage.setItem(KEY, encodePending(pending, Date.now()));
	} catch {
		// Without storage the user lands on the list after sign-in, as before.
	}
}

export function peekPendingReturn(): PendingReturn | null {
	try {
		return decodePending(localStorage.getItem(KEY), Date.now());
	} catch {
		return null;
	}
}

export function clearPendingReturn() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing to clear.
	}
}

export function takePendingPublish(docId: string): boolean {
	const pending = peekPendingReturn();
	if (pending?.kind !== 'publish') return false;
	clearPendingReturn();
	return pending.docId === docId;
}
