import { describe, expect, it } from 'vitest';
import { parseHash } from './route';

describe('parseHash', () => {
	it('resolves an editor hash', () => {
		expect(parseHash('#/s/abc%20def')).toEqual({ page: 'editor', id: 'abc def' });
	});

	it('resolves a published hash', () => {
		const id = '3f2b8c1e-5a4d-4e7b-9c1a-2d3e4f5a6b7c';
		expect(parseHash(`#/p/${id}`)).toEqual({ page: 'published', id });
	});

	it('passes a made-up published id through', () => {
		expect(parseHash('#/p/anything')).toEqual({ page: 'published', id: 'anything' });
	});

	it('resolves a magic-link callback to the list', () => {
		expect(parseHash('#access_token=abc&refresh_token=def&type=magiclink')).toEqual({ page: 'list' });
	});

	it('resolves an auth error callback to the list', () => {
		expect(parseHash('#error=access_denied&error_code=otp_expired')).toEqual({ page: 'list' });
	});
});
