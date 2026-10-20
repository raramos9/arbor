import { useRoute } from './route';
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
		case 'list':
			return <ListScreen />;
		default: {
			const unreachable: never = route;
			return unreachable;
		}
	}
}
