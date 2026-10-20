import { z } from 'zod';

// Sign-in leaves the page (Google redirect) or opens a new tab (magic link), and the
// implicit flow clears the hash on return. Remembering the strategy in localStorage lets
// whichever tab gets the session go back to it and resume publishing.
const KEY = 'arbor.pendingPublish';
export const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

const PendingSchema = z.object({ docId: z.string().min(1), at: z.number() });

export function encodePending(docId: string, now: number): string {
	return JSON.stringify({ docId, at: now });
}

export function decodePending(raw: string | null, now: number): string | null {
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
	return age >= 0 && age <= PENDING_MAX_AGE_MS ? parsed.data.docId : null;
}

export function rememberPendingPublish(docId: string) {
	try {
		localStorage.setItem(KEY, encodePending(docId, Date.now()));
	} catch {
		// Without storage the user lands on the list after sign-in, as before.
	}
}

export function peekPendingPublish(): string | null {
	try {
		return decodePending(localStorage.getItem(KEY), Date.now());
	} catch {
		return null;
	}
}

export function clearPendingPublish() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing to clear.
	}
}

export function takePendingPublish(docId: string): boolean {
	const pending = peekPendingPublish();
	if (pending === null) return false;
	clearPendingPublish();
	return pending === docId;
}
