import { describe, expect, it } from 'vitest';
import { hostOf, mediaLabel, parseMediaUrl, youtubeEmbed, youtubeThumbnail } from './media';
import type { Media } from './strategy';

const ID = 'dQw4w9WgXcQ';

function parsed(input: string): Media {
	const result = parseMediaUrl(input);
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

function failure(input: string): string {
	const result = parseMediaUrl(input);
	if (result.ok) throw new Error('expected failure');
	return result.error;
}

function youtube(input: string) {
	const media = parsed(input);
	if (media.provider !== 'youtube') throw new Error(`expected youtube, got ${media.provider}`);
	return media;
}

describe('parseMediaUrl rejections', () => {
	it('rejects empty input', () => {
		expect(failure('   ')).toMatch(/enter a link/i);
	});
	it('rejects text that is not a URL', () => {
		expect(failure('not a link')).toMatch(/not a valid link/i);
		expect(failure('youtube.com/watch?v=dQw4w9WgXcQ')).toMatch(/not a valid link/i);
	});
	it('rejects non-http schemes', () => {
		for (const input of [
			'javascript:alert(1)',
			'JavaScript:alert(1)',
			'data:text/html,<script>alert(1)</script>',
			'file:///etc/passwd',
			'ftp://example.com/a',
			'mailto:a@b.com',
		]) {
			expect(failure(input)).toMatch(/only http and https/i);
		}
	});
});

describe('parseMediaUrl youtube', () => {
	it('reads watch URLs', () => {
		expect(youtube(`https://www.youtube.com/watch?v=${ID}`)).toEqual({
			provider: 'youtube',
			title: '',
			url: `https://www.youtube.com/watch?v=${ID}`,
			videoId: ID,
			startSeconds: null,
		});
	});
	it('accepts http, bare and mobile hosts', () => {
		expect(youtube(`http://youtube.com/watch?v=${ID}`).videoId).toBe(ID);
		expect(youtube(`https://m.youtube.com/watch?v=${ID}`).videoId).toBe(ID);
	});
	it('reads the id when v is not the first parameter', () => {
		expect(youtube(`https://www.youtube.com/watch?feature=share&v=${ID}&list=PL1`).videoId).toBe(ID);
	});
	it('reads youtu.be, shorts and embed paths', () => {
		expect(youtube(`https://youtu.be/${ID}`).videoId).toBe(ID);
		expect(youtube(`https://www.youtube.com/shorts/${ID}`).videoId).toBe(ID);
		expect(youtube(`https://www.youtube.com/embed/${ID}`).videoId).toBe(ID);
	});
	it('trims surrounding whitespace', () => {
		expect(youtube(`  https://youtu.be/${ID}\n`).url).toBe(`https://youtu.be/${ID}`);
	});
	it('reads start times in each format', () => {
		const at = (t: string) => youtube(`https://youtu.be/${ID}?t=${t}`).startSeconds;
		expect(at('90')).toBe(90);
		expect(at('90s')).toBe(90);
		expect(at('1m30s')).toBe(90);
		expect(at('1h2m3s')).toBe(3723);
		expect(at('2m')).toBe(120);
		expect(at('1h')).toBe(3600);
		expect(at('0')).toBe(0);
	});
	it('reads the start parameter and prefers t', () => {
		expect(youtube(`https://www.youtube.com/embed/${ID}?start=45`).startSeconds).toBe(45);
		expect(youtube(`https://youtu.be/${ID}?t=10&start=45`).startSeconds).toBe(10);
	});
	it('ignores unreadable start times', () => {
		for (const t of ['', 'abc', '1x', '-5', '1.5', 'm30s']) {
			expect(youtube(`https://youtu.be/${ID}?t=${t}`).startSeconds).toBeNull();
		}
	});
	it('falls back to web for bad ids and unsupported paths', () => {
		expect(parsed('https://www.youtube.com/watch?v=short').provider).toBe('web');
		expect(parsed(`https://www.youtube.com/watch?v=${ID}x`).provider).toBe('web');
		expect(parsed('https://www.youtube.com/watch').provider).toBe('web');
		expect(parsed('https://youtu.be/').provider).toBe('web');
		expect(parsed('https://www.youtube.com/@channel').provider).toBe('web');
		expect(parsed(`https://evil.com/watch?v=${ID}`).provider).toBe('web');
		expect(parsed(`https://notyoutube.com/watch?v=${ID}`).provider).toBe('web');
	});
});

describe('parseMediaUrl instagram', () => {
	it('reads reels, posts and tv with or without www', () => {
		for (const path of ['reel/C1a_b-2', 'p/C1a_b-2', 'tv/C1a_b-2', 'reel/C1a_b-2/']) {
			for (const host of ['instagram.com', 'www.instagram.com']) {
				const url = `https://${host}/${path}`;
				expect(parsed(url)).toEqual({ provider: 'instagram', title: '', url });
			}
		}
	});
	it('ignores query strings', () => {
		expect(parsed('https://www.instagram.com/reel/C1a/?igsh=abc').provider).toBe('instagram');
	});
	it('treats profiles and other paths as web', () => {
		expect(parsed('https://www.instagram.com/someone/').provider).toBe('web');
		expect(parsed('https://www.instagram.com/reel/').provider).toBe('web');
		expect(parsed('https://www.instagram.com/stories/x/1').provider).toBe('web');
	});
	it('does not trust lookalike hosts', () => {
		expect(parsed('https://instagram.com.evil.com/reel/C1a').provider).toBe('web');
	});
});

describe('parseMediaUrl web', () => {
	it('accepts any other http(s) URL', () => {
		expect(parsed('https://example.com/a?b=c#d')).toEqual({
			provider: 'web',
			title: '',
			url: 'https://example.com/a?b=c#d',
		});
		expect(parsed('http://example.com').provider).toBe('web');
	});
});

describe('youtube URLs', () => {
	it('builds the thumbnail URL', () => {
		expect(youtubeThumbnail(ID)).toBe(`https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
	});
	it('builds the embed URL with and without a start', () => {
		expect(youtubeEmbed(ID, null)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`);
		expect(youtubeEmbed(ID, 90)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&start=90`);
	});
});

describe('labels', () => {
	it('reads the host of a URL', () => {
		expect(hostOf('https://example.com/a')).toBe('example.com');
		expect(hostOf('nonsense')).toBe('nonsense');
	});
	it('prefers the title, then falls back by provider', () => {
		expect(mediaLabel({ ...youtube(`https://youtu.be/${ID}`), title: 'Arm drag' })).toBe('Arm drag');
		expect(mediaLabel(youtube(`https://youtu.be/${ID}`))).toBe('YouTube video');
		expect(mediaLabel(parsed('https://example.com/a'))).toBe('example.com');
		expect(mediaLabel(parsed('https://www.instagram.com/reel/C1a'))).toBe('www.instagram.com');
	});
});
