import { describe, expect, it } from 'vitest';
import { parseAuthRedirectError } from './authRedirect';

describe('parseAuthRedirectError', () => {
	it('returns null for an empty hash', () => {
		expect(parseAuthRedirectError('')).toBeNull();
	});

	it('returns null when there is no error param', () => {
		expect(parseAuthRedirectError('#access_token=abc&type=magiclink')).toBeNull();
	});

	it('explains an expired link', () => {
		const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
		expect(parseAuthRedirectError(hash)).toBe(
			'That sign-in link has expired or was already used. Send yourself a new one.',
		);
	});

	it('never shows text taken from the link', () => {
		expect(parseAuthRedirectError('#error=server_error&error_description=Your+account+is+locked')).toBe(
			'Sign-in failed. Try again.',
		);
	});
});
