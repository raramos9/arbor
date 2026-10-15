import { useRoute } from './route';
import { ListScreen } from './ui/ListScreen';
import { EditorScreen } from './ui/EditorScreen';

export function App() {
	const route = useRoute();
	return route.page === 'editor' ? <EditorScreen key={route.id} id={route.id} /> : <ListScreen />;
}
