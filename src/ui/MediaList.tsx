import { useState } from 'react';
import type { ApplyResult, Command, MediaOwner } from '../model/commands';
import { hostOf, mediaLabel, parseMediaUrl, youtubeEmbed, youtubeThumbnail } from '../model/media';
import type { Media } from '../model/strategy';
import { Field } from './Field';

type Props = {
	owner: MediaOwner;
	media: readonly Media[];
	exec: (cmd: Command) => ApplyResult;
};

function mediaKey(media: Media, index: number): string {
	return media.provider === 'clip' ? `${index}:${media.clipId}` : `${index}:${media.url}`;
}

export function MediaList({ owner, media, exec }: Props) {
	const [input, setInput] = useState('');
	const [error, setError] = useState<string | null>(null);

	function add() {
		const parsed = parseMediaUrl(input);
		if (!parsed.ok) {
			setError(parsed.error);
			return;
		}
		if (exec({ type: 'addMedia', owner, media: parsed.value }).ok) {
			setInput('');
			setError(null);
		}
	}

	return (
		<section className="media-section">
			<h3>Media</h3>
			<ul className="media-list">
				{media.map((item, index) => (
					<li key={mediaKey(item, index)} className="media-item">
						<Field
							label="Title"
							value={item.title}
							onChange={(title) => exec({ type: 'updateMediaTitle', owner, index, title })}
						/>
						<MediaPreview media={item} />
						<button className="danger" onClick={() => exec({ type: 'removeMedia', owner, index })}>
							Remove
						</button>
					</li>
				))}
			</ul>
			<div className="media-add">
				<input
					value={input}
					placeholder="Paste a YouTube, Instagram, or web link"
					onChange={(e) => {
						setInput(e.target.value);
						setError(null);
					}}
					onKeyDown={(e) => {
						if (e.key !== 'Enter') return;
						e.preventDefault();
						add();
					}}
				/>
				<button onClick={add}>Add link</button>
			</div>
			{error && <p className="error">{error}</p>}
		</section>
	);
}

function MediaPreview({ media }: { media: Media }) {
	switch (media.provider) {
		case 'youtube':
			return <YouTubePreview videoId={media.videoId} startSeconds={media.startSeconds} url={media.url} />;
		case 'instagram':
			return <LinkCard media={media} note="Opens on Instagram" />;
		case 'web':
			return <LinkCard media={media} note={null} />;
		case 'clip':
			return <p className="muted">Clip preview is not available yet.</p>;
		default: {
			const unreachable: never = media;
			return unreachable;
		}
	}
}

function LinkCard({ media, note }: { media: Extract<Media, { url: string }>; note: string | null }) {
	return (
		<a className="link-card" href={media.url} target="_blank" rel="noopener noreferrer">
			<strong>{mediaLabel(media)}</strong>
			<span className="muted">{hostOf(media.url)}</span>
			{note && <span className="muted">{note}</span>}
		</a>
	);
}

type YouTubeProps = { videoId: string; startSeconds: number | null; url: string };

function YouTubePreview({ videoId, startSeconds, url }: YouTubeProps) {
	const [playing, setPlaying] = useState(false);
	const [thumbnailFailed, setThumbnailFailed] = useState(false);

	if (playing) {
		return (
			<div className="video-frame">
				<iframe
					src={youtubeEmbed(videoId, startSeconds)}
					title="YouTube video"
					allow="autoplay; encrypted-media; picture-in-picture"
					allowFullScreen
				/>
			</div>
		);
	}
	if (thumbnailFailed) {
		return (
			<div className="video-frame unavailable">
				<span>Preview unavailable</span>
				<a href={url} target="_blank" rel="noopener noreferrer">
					Open on YouTube
				</a>
			</div>
		);
	}
	return (
		<button className="video-frame play" aria-label="Play video" onClick={() => setPlaying(true)}>
			<img src={youtubeThumbnail(videoId)} alt="" onError={() => setThumbnailFailed(true)} />
			<span className="play-overlay" aria-hidden="true">
				▶
			</span>
		</button>
	);
}
