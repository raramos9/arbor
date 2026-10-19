import { describe, expect, it } from 'vitest';
import { decodeBlob, encodeBlob } from './exchange';

describe('blob encoding', () => {
	it('round-trips several hundred KB of random bytes', async () => {
		const bytes = new Uint8Array(600_000);
		for (let i = 0; i < bytes.length; i += 65_536) crypto.getRandomValues(bytes.subarray(i, i + 65_536));
		const decoded = decodeBlob(await encodeBlob(new Blob([bytes], { type: 'video/mp4' })));
		expect(decoded.type).toBe('video/mp4');
		expect(new Uint8Array(await decoded.arrayBuffer())).toEqual(bytes);
	});
});
