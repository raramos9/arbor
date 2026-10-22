import { useState } from 'react';
import { listStrategies } from '../storage';
import { cloud } from '../supabase';
import { homeVisit } from './landing';
import { LandingScreen } from './LandingScreen';
import { ListScreen } from './ListScreen';
import { useSessionPresence } from './useSessionPresence';

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
