import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Database } from '../database.types';
import type { SessionPresence } from './landing';

export function useSessionPresence(client: SupabaseClient<Database> | null): SessionPresence {
	const [presence, setPresence] = useState<SessionPresence>(client ? 'loading' : 'signed-out');
	useEffect(() => {
		if (!client) return;
		let active = true;
		void client.auth.getSession().then(({ data }) => {
			if (active) setPresence(data.session ? 'signed-in' : 'signed-out');
		});
		const { data } = client.auth.onAuthStateChange((_event, session) => {
			setPresence(session ? 'signed-in' : 'signed-out');
		});
		return () => {
			active = false;
			data.subscription.unsubscribe();
		};
	}, [client]);
	return presence;
}
