import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Database } from '../database.types';
import { listStrategies } from '../storage';
import { cloud } from '../supabase';
import { homeVisit, type SessionPresence } from './landing';
import { LandingScreen } from './LandingScreen';
import { ListScreen } from './ListScreen';

function useSessionPresence(client: SupabaseClient<Database> | null): SessionPresence {
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

export function HomeRoute() {
	const [hasSaved] = useState(() => listStrategies().length > 0);
	const presence = useSessionPresence(cloud);
	switch (homeVisit(hasSaved, presence)) {
		case 'checking':
			return <div className="page" aria-busy="true" />;
		case 'landing':
			return <LandingScreen />;
		case 'home':
			return <ListScreen />;
	}
}
