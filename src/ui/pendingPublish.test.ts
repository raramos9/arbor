import { describe, expect, it } from 'vitest';
import { PENDING_MAX_AGE_MS, decodePending, encodePending } from './pendingPublish';

describe('decodePending', () => {
	it('round-trips a fresh entry', () => {
		expect(decodePending(encodePending('abc', 1000), 1000 + 5000)).toBe('abc');
	});

	it('returns null when nothing is stored', () => {
		expect(decodePending(null, 0)).toBeNull();
	});

	it('expires after the max age', () => {
		expect(decodePending(encodePending('abc', 0), PENDING_MAX_AGE_MS + 1)).toBeNull();
	});

	it('rejects an entry from the future', () => {
		expect(decodePending(encodePending('abc', 10_000), 0)).toBeNull();
	});

	it('rejects malformed json and wrong shapes', () => {
		expect(decodePending('{', 0)).toBeNull();
		expect(decodePending('{"docId":"","at":0}', 0)).toBeNull();
		expect(decodePending('{"docId":"abc"}', 0)).toBeNull();
	});
});
