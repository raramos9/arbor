import { useRoute } from './route';
import { ExploreScreen } from './ui/ExploreScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { ListScreen } from './ui/ListScreen';
import { EditorScreen } from './ui/EditorScreen';
import { ViewerScreen } from './ui/ViewerScreen';

export function App() {
	const route = useRoute();
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
			return <ListScreen />;
		default: {
			const unreachable: never = route;
			return unreachable;
		}
	}
}
