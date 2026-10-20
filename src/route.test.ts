import { describe, expect, it } from 'vitest';
import { parseHash } from './route';

describe('parseHash', () => {
	it('resolves an editor hash', () => {
		expect(parseHash('#/s/abc%20def')).toEqual({ page: 'editor', id: 'abc def' });
	});

	it('resolves a magic-link callback to the list', () => {
		expect(parseHash('#access_token=abc&refresh_token=def&type=magiclink')).toEqual({ page: 'list' });
	});

	it('resolves an auth error callback to the list', () => {
		expect(parseHash('#error=access_denied&error_code=otp_expired')).toEqual({ page: 'list' });
	});
});
