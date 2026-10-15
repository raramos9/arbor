import type { Media, Result } from './strategy';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]+$/;
const INSTAGRAM_KINDS: readonly string[] = ['reel', 'p', 'tv'];
const YOUTUBE_HOSTS: readonly string[] = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
const YOUTUBE_VIDEO_PREFIXES: readonly string[] = ['shorts', 'embed'];
const INSTAGRAM_HOSTS: readonly string[] = ['instagram.com', 'www.instagram.com'];
const CLOCK_TIME = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
const PLAIN_SECONDS = /^\d+$/;

function parseSeconds(raw: string | null): number | null {
	if (!raw) return null;
	if (PLAIN_SECONDS.test(raw)) return Number(raw);
	const match = CLOCK_TIME.exec(raw);
	if (!match) return null;
	const [, h, m, s] = match;
	if (h === undefined && m === undefined && s === undefined) return null;
	return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

function youtubeVideoId(url: URL): string | null {
	const segments = url.pathname.split('/').filter((s) => s !== '');
	const [first, second] = segments;
	if (url.hostname === 'youtu.be') return first ?? null;
	if (!YOUTUBE_HOSTS.includes(url.hostname)) return null;
	if (first === 'watch') return url.searchParams.get('v');
	if (first !== undefined && YOUTUBE_VIDEO_PREFIXES.includes(first)) return second ?? null;
	return null;
}

function isInstagramPost(url: URL): boolean {
	if (!INSTAGRAM_HOSTS.includes(url.hostname)) return false;
	const [kind, code] = url.pathname.split('/').filter((s) => s !== '');
	return kind !== undefined && INSTAGRAM_KINDS.includes(kind) && code !== undefined && INSTAGRAM_CODE.test(code);
}

export function parseMediaUrl(input: string): Result<Media> {
	const trimmed = input.trim();
	if (trimmed === '') return { ok: false, error: 'Enter a link.' };
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return { ok: false, error: 'That is not a valid link. Include the https:// at the start.' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, error: 'Only http and https links are supported.' };
	}
	const videoId = youtubeVideoId(url);
	if (videoId !== null && VIDEO_ID.test(videoId)) {
		const start = parseSeconds(url.searchParams.get('t')) ?? parseSeconds(url.searchParams.get('start'));
		return {
			ok: true,
			value: { provider: 'youtube', title: '', url: trimmed, videoId, startSeconds: start },
		};
	}
	if (isInstagramPost(url)) return { ok: true, value: { provider: 'instagram', title: '', url: trimmed } };
	return { ok: true, value: { provider: 'web', title: '', url: trimmed } };
}

export function youtubeThumbnail(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function youtubeEmbed(videoId: string, startSeconds: number | null): string {
	const base = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
	return startSeconds === null ? base : `${base}&start=${startSeconds}`;
}

export function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export function mediaLabel(media: Media): string {
	if (media.title !== '') return media.title;
	switch (media.provider) {
		case 'youtube':
			return 'YouTube video';
		case 'instagram':
		case 'web':
			return hostOf(media.url);
		case 'clip':
			return 'Clip';
		default: {
			const unreachable: never = media;
			return String(unreachable);
		}
	}
}
