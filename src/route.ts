import { useEffect, useState } from 'react';
import type { Handle, PublishedId } from './model/strategy';

export type Route =
	| { page: 'list' }
	| { page: 'editor'; id: string }
	| { page: 'published'; id: string }
	| { page: 'explore' }
	| { page: 'profile'; handle: string };

export function parseHash(hash: string): Route {
	const match = /^#\/s\/(.+)$/.exec(hash);
	if (match?.[1]) return { page: 'editor', id: decodeURIComponent(match[1]) };
	const published = /^#\/p\/(.+)$/.exec(hash);
	if (published?.[1]) return { page: 'published', id: decodeURIComponent(published[1]) };
	if (hash === '#/explore') return { page: 'explore' };
	const profile = /^#\/u\/(.+)$/.exec(hash);
	if (profile?.[1]) return { page: 'profile', handle: decodeURIComponent(profile[1]) };
	return { page: 'list' };
}

export const editorHref = (id: string) => `#/s/${encodeURIComponent(id)}`;
export const publishedHref = (id: PublishedId) => `#/p/${encodeURIComponent(id)}`;
export const exploreHref = '#/explore';
export const profileHref = (handle: Handle) => `#/u/${encodeURIComponent(handle)}`;

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
