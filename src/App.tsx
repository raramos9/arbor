import { useEffect } from 'react';
import { hasStrategy } from './storage';
import { cloud } from './supabase';
import { editorHref, navigate, useRoute } from './route';
import { clearPendingReturn, peekPendingReturn } from './ui/pendingReturn';
import { ExploreScreen } from './ui/ExploreScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { HomeRoute } from './ui/HomeRoute';
import { EditorScreen } from './ui/EditorScreen';
import { SignedInOnly } from './ui/SignedInOnly';
import { ViewerScreen } from './ui/ViewerScreen';

function useReturnAfterSignIn() {
	useEffect(() => {
		if (!cloud) return;
		const { data } = cloud.auth.onAuthStateChange((event, session) => {
			if (!session || (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION')) return;
			const pending = peekPendingReturn();
			if (pending === null) return;
			if (pending.kind === 'open') {
				clearPendingReturn();
				if (window.location.hash !== pending.hash) navigate(pending.hash);
				return;
			}
			if (!hasStrategy(pending.docId)) {
				clearPendingReturn();
				return;
			}
			const href = editorHref(pending.docId);
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
			return (
				<SignedInOnly title="Sign in to see this game plan">
					<ViewerScreen key={route.id} id={route.id} />
				</SignedInOnly>
			);
		case 'explore':
			return (
				<SignedInOnly title="Sign in to explore game plans">
					<ExploreScreen />
				</SignedInOnly>
			);
		case 'profile':
			return (
				<SignedInOnly title={`Sign in to see @${route.handle}’s game plans`}>
					<ProfileScreen key={route.handle} handle={route.handle} />
				</SignedInOnly>
			);
		case 'list':
			return <HomeRoute />;
		default: {
			const unreachable: never = route;
			return unreachable;
		}
	}
}
