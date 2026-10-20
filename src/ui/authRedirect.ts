export function parseAuthRedirectError(hash: string): string | null {
	const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
	if (!params.has('error')) return null;
	if (params.get('error_code') === 'otp_expired') {
		return 'That sign-in link has expired or was already used. Send yourself a new one.';
	}
	return 'Sign-in failed. Try again.';
}
