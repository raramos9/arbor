import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { HandleSchema, UserIdSchema } from '../model/publishing';
import { toSessionState, type LoadedProfile } from './useSession';

const id = '5b1f3c52-6a4e-4d0a-9d52-1f6f0f8f2a11';

function sessionFor(user: { id: string; email?: string }): Session {
	return { user } as Session;
}

const handle = HandleSchema.parse('ada');
const loaded: LoadedProfile = { userId: UserIdSchema.parse(id), handle };

describe('toSessionState', () => {
	it('maps an unknown session to loading', () => {
		expect(toSessionState(undefined, null)).toEqual({ status: 'loading' });
	});

	it('maps no session to signed-out', () => {
		expect(toSessionState(null, null)).toEqual({ status: 'signed-out' });
	});

	it('stays loading until the profile for that user has loaded', () => {
		const session = sessionFor({ id, email: 'a@b.co' });
		expect(toSessionState(session, null)).toEqual({ status: 'loading' });
		const other = { userId: UserIdSchema.parse('6c2f3c52-6a4e-4d0a-9d52-1f6f0f8f2a11'), handle };
		expect(toSessionState(session, other)).toEqual({ status: 'loading' });
	});

	it('maps a valid session with its profile to signed-in', () => {
		expect(toSessionState(sessionFor({ id, email: 'a@b.co' }), loaded)).toEqual({
			status: 'signed-in',
			userId: id,
			email: 'a@b.co',
			handle,
		});
	});

	it('carries a missing handle as null', () => {
		expect(toSessionState(sessionFor({ id, email: 'a@b.co' }), { ...loaded, handle: null })).toMatchObject({
			status: 'signed-in',
			handle: null,
		});
	});

	it('maps an unparseable user id to signed-out', () => {
		expect(toSessionState(sessionFor({ id: 'nope', email: 'a@b.co' }), loaded)).toEqual({ status: 'signed-out' });
	});

	it('maps a missing email to signed-out', () => {
		expect(toSessionState(sessionFor({ id }), loaded)).toEqual({ status: 'signed-out' });
	});
});
