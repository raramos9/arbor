import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Database } from '../database.types';
import { UserIdSchema, type UserId } from '../model/publishing';

export type SessionState =
	| { status: 'loading' }
	| { status: 'signed-out' }
	| { status: 'signed-in'; userId: UserId; email: string };

export function toSessionState(session: Session | null): SessionState {
	if (!session) return { status: 'signed-out' };
	const userId = UserIdSchema.safeParse(session.user.id);
	const email = session.user.email;
	if (!userId.success || !email) return { status: 'signed-out' };
	return { status: 'signed-in', userId: userId.data, email };
}

export function useSession(client: SupabaseClient<Database>): SessionState {
	const [state, setState] = useState<SessionState>({ status: 'loading' });
	useEffect(() => {
		let active = true;
		void client.auth.getSession().then(({ data }) => {
			if (active) setState(toSessionState(data.session));
		});
		const { data } = client.auth.onAuthStateChange((_event, session) => {
			setState(toSessionState(session));
		});
		return () => {
			active = false;
			data.subscription.unsubscribe();
		};
	}, [client]);
	return state;
}
