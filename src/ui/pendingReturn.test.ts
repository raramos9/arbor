import { describe, expect, it } from 'vitest';
import { PENDING_MAX_AGE_MS, decodePending, encodePending } from './pendingReturn';

const publish = { kind: 'publish', docId: 'abc' } as const;
const open = { kind: 'open', hash: '#/p/123' } as const;

describe('decodePending', () => {
	it('round-trips a fresh entry of each kind', () => {
		expect(decodePending(encodePending(publish, 1000), 1000 + 5000)).toEqual(publish);
		expect(decodePending(encodePending(open, 1000), 1000 + 5000)).toEqual(open);
	});

	it('returns null when nothing is stored', () => {
		expect(decodePending(null, 0)).toBeNull();
	});

	it('expires after the max age', () => {
		expect(decodePending(encodePending(publish, 0), PENDING_MAX_AGE_MS + 1)).toBeNull();
	});

	it('rejects an entry from the future', () => {
		expect(decodePending(encodePending(open, 10_000), 0)).toBeNull();
	});

	it('rejects malformed json and wrong shapes', () => {
		expect(decodePending('{', 0)).toBeNull();
		expect(decodePending('{"kind":"publish","docId":"","at":0}', 0)).toBeNull();
		expect(decodePending('{"kind":"publish","docId":"abc"}', 0)).toBeNull();
		expect(decodePending('{"kind":"open","hash":"https://evil.example","at":0}', 0)).toBeNull();
		expect(decodePending('{"docId":"abc","at":0}', 0)).toBeNull();
	});
});
