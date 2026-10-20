import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { toSessionState } from './useSession';

const id = '5b1f3c52-6a4e-4d0a-9d52-1f6f0f8f2a11';

function sessionFor(user: { id: string; email?: string }): Session {
	return { user } as Session;
}

describe('toSessionState', () => {
	it('maps no session to signed-out', () => {
		expect(toSessionState(null)).toEqual({ status: 'signed-out' });
	});

	it('maps a valid session to signed-in', () => {
		expect(toSessionState(sessionFor({ id, email: 'a@b.co' }))).toEqual({
			status: 'signed-in',
			userId: id,
			email: 'a@b.co',
		});
	});

	it('maps an unparseable user id to signed-out', () => {
		expect(toSessionState(sessionFor({ id: 'nope', email: 'a@b.co' }))).toEqual({ status: 'signed-out' });
	});

	it('maps a missing email to signed-out', () => {
		expect(toSessionState(sessionFor({ id }))).toEqual({ status: 'signed-out' });
	});
});
