import { useEffect } from 'react';
import { hasStrategy } from './storage';
import { cloud } from './supabase';
import { editorHref, navigate, useRoute } from './route';
import { clearPendingPublish, peekPendingPublish } from './ui/pendingPublish';
import { ExploreScreen } from './ui/ExploreScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { HomeRoute } from './ui/HomeRoute';
import { EditorScreen } from './ui/EditorScreen';
import { ViewerScreen } from './ui/ViewerScreen';

function useReturnAfterSignIn() {
	useEffect(() => {
		if (!cloud) return;
		const { data } = cloud.auth.onAuthStateChange((event, session) => {
			if (!session || (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION')) return;
			const docId = peekPendingPublish();
			if (docId === null) return;
			if (!hasStrategy(docId)) {
				clearPendingPublish();
				return;
			}
			const href = editorHref(docId);
			if (window.location.hash !== href) navigate(href);
		});
		return () => data.subscription.unsubscribe();
	}, []);
}

export function App() {
	const route = useRoute();
	useReturnAfterSignIn();
	switch (route.page) {
		case 'editor':
			return <EditorScreen key={route.id} id={route.id} />;
		case 'published':
			return <ViewerScreen key={route.id} id={route.id} />;
		case 'explore':
			return <ExploreScreen />;
		case 'profile':
			return <ProfileScreen key={route.handle} handle={route.handle} />;
		case 'list':
			return <HomeRoute />;
		default: {
			const unreachable: never = route;
			return unreachable;
		}
	}
}
