import { useEffect, useState } from 'react';
import type { PublishedId } from './model/publishing';

export type Route = { page: 'list' } | { page: 'editor'; id: string } | { page: 'published'; id: string };

export function parseHash(hash: string): Route {
	const match = /^#\/s\/(.+)$/.exec(hash);
	if (match?.[1]) return { page: 'editor', id: decodeURIComponent(match[1]) };
	const published = /^#\/p\/(.+)$/.exec(hash);
	if (published?.[1]) return { page: 'published', id: decodeURIComponent(published[1]) };
	return { page: 'list' };
}

export const editorHref = (id: string) => `#/s/${encodeURIComponent(id)}`;
export const publishedHref = (id: PublishedId) => `#/p/${encodeURIComponent(id)}`;

export function navigate(hash: string) {
	window.location.hash = hash;
}

export function useRoute(): Route {
	const [route, setRoute] = useState(() => parseHash(window.location.hash));
	useEffect(() => {
		const onChange = () => setRoute(parseHash(window.location.hash));
		window.addEventListener('hashchange', onChange);
		return () => window.removeEventListener('hashchange', onChange);
	}, []);
	return route;
}
