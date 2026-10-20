import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import type { Database } from '../database.types';
import { UserIdSchema, type UserId } from '../model/publishing';
import { HandleSchema, type Handle } from '../model/strategy';

export type SessionState =
	| { status: 'loading' }
	| { status: 'signed-out' }
	| { status: 'signed-in'; userId: UserId; email: string; handle: Handle | null };

export type LoadedProfile = { userId: UserId; handle: Handle | null };

function identityOf(session: Session): { userId: UserId; email: string } | null {
	const userId = UserIdSchema.safeParse(session.user.id);
	const email = session.user.email;
	if (!userId.success || !email) return null;
	return { userId: userId.data, email };
}

export function toSessionState(session: Session | null | undefined, profile: LoadedProfile | null): SessionState {
	if (session === undefined) return { status: 'loading' };
	if (session === null) return { status: 'signed-out' };
	const identity = identityOf(session);
	if (!identity) return { status: 'signed-out' };
	if (profile?.userId !== identity.userId) return { status: 'loading' };
	return { status: 'signed-in', ...identity, handle: profile.handle };
}

export function useSession(client: SupabaseClient<Database>): [SessionState, (handle: Handle) => void] {
	const [session, setSession] = useState<Session | null | undefined>(undefined);
	const [profile, setProfile] = useState<LoadedProfile | null>(null);
	const userId = (session && identityOf(session)?.userId) || null;

	useEffect(() => {
		let active = true;
		void client.auth.getSession().then(({ data }) => {
			if (active) setSession(data.session);
		});
		const { data } = client.auth.onAuthStateChange((_event, next) => {
			setSession(next);
		});
		return () => {
			active = false;
			data.subscription.unsubscribe();
		};
	}, [client]);

	useEffect(() => {
		if (userId === null) return;
		let active = true;
		void client
			.from('profiles')
			.select('handle')
			.eq('id', userId)
			.maybeSingle()
			.then(({ data, error }) => {
				if (!active) return;
				const handle = error ? null : HandleSchema.nullable().safeParse(data?.handle ?? null);
				setProfile({ userId, handle: handle && handle.success ? handle.data : null });
			});
		return () => {
			active = false;
		};
	}, [client, userId]);

	const setHandle = useCallback(
		(handle: Handle) => {
			if (userId !== null) setProfile({ userId, handle });
		},
		[userId],
	);

	return [toSessionState(session, profile), setHandle];
}
