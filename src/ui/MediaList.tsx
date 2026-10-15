import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { ApplyResult, Command, MediaOwner } from '../model/commands';
import { deleteClip, getClip, saveClip, type StoredClip } from '../clips';
import {
	formatDuration,
	hostOf,
	mediaLabel,
	parseMediaUrl,
	youtubeEmbed,
	youtubeThumbnail,
} from '../model/media';
import { newClipId, type Media } from '../model/strategy';
import { Field } from './Field';
import { readVideo } from './poster';

type ClipMedia = Extract<Media, { provider: 'clip' }>;

const MAX_CLIP_BYTES = 300 * 1024 * 1024;
const MEGABYTE = 1024 * 1024;

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
	const [saving, setSaving] = useState(false);
	const recordRef = useRef<HTMLInputElement>(null);
	const uploadRef = useRef<HTMLInputElement>(null);

	async function addClip(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		if (file.type !== '' && !file.type.startsWith('video/')) {
			setError('That file is not a video.');
			return;
		}
		if (file.size > MAX_CLIP_BYTES) {
			setError(
				`That clip is ${Math.ceil(file.size / MEGABYTE)} MB. Clips can be at most ${MAX_CLIP_BYTES / MEGABYTE} MB.`,
			);
			return;
		}
		setError(null);
		setSaving(true);
		const { poster, durationSeconds } = await readVideo(file);
		const clipId = newClipId();
		const saved = await saveClip({ id: clipId, blob: file, poster, createdAt: new Date().toISOString() });
		if (!saved.ok) {
			setSaving(false);
			setError(saved.error);
			return;
		}
		const media: ClipMedia = {
			provider: 'clip',
			title: file.name.replace(/\.[^.]+$/, ''),
			clipId,
			mimeType: file.type,
			durationSeconds,
			sizeBytes: file.size,
		};
		if (!exec({ type: 'addMedia', owner, media }).ok) await deleteClip(clipId);
		setSaving(false);
	}

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
			<div className="media-add">
				<button disabled={saving} onClick={() => recordRef.current?.click()}>
					Record clip
				</button>
				<button disabled={saving} onClick={() => uploadRef.current?.click()}>
					Upload clip
				</button>
				<input ref={recordRef} type="file" accept="video/*" capture="environment" hidden onChange={addClip} />
				<input ref={uploadRef} type="file" accept="video/*" hidden onChange={addClip} />
			</div>
			{saving && <p className="muted">Saving clip…</p>}
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
			return <ClipPreview media={media} />;
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

type ClipState =
	| { status: 'loading' }
	| { status: 'missing' }
	| { status: 'error'; error: string }
	| { status: 'ready'; clip: StoredClip; posterUrl: string | null; videoUrl: string };

function ClipPreview({ media }: { media: ClipMedia }) {
	const [state, setState] = useState<ClipState>({ status: 'loading' });
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const urls: string[] = [];
		const objectUrl = (blob: Blob): string => {
			const url = URL.createObjectURL(blob);
			urls.push(url);
			return url;
		};
		void getClip(media.clipId).then((result) => {
			if (cancelled) return;
			if (!result.ok) setState({ status: 'error', error: result.error });
			else if (!result.value) setState({ status: 'missing' });
			else {
				const clip = result.value;
				setState({
					status: 'ready',
					clip,
					posterUrl: clip.poster ? objectUrl(clip.poster) : null,
					videoUrl: objectUrl(clip.blob),
				});
			}
		});
		return () => {
			cancelled = true;
			for (const url of urls) URL.revokeObjectURL(url);
		};
	}, [media.clipId]);

	return (
		<>
			<p className="muted">Only on this device</p>
			<ClipBody media={media} state={state} playing={playing} onPlay={() => setPlaying(true)} />
		</>
	);
}

type ClipBodyProps = { media: ClipMedia; state: ClipState; playing: boolean; onPlay: () => void };

function ClipBody({ media, state, playing, onPlay }: ClipBodyProps) {
	switch (state.status) {
		case 'loading':
			return <div className="video-frame unavailable">Loading clip…</div>;
		case 'missing':
			return <div className="video-frame unavailable">This clip isn't on this device</div>;
		case 'error':
			return <div className="video-frame unavailable">{state.error}</div>;
		case 'ready':
			if (playing) {
				return (
					<div className="video-frame">
						<video src={state.videoUrl} controls autoPlay playsInline />
					</div>
				);
			}
			return (
				<button className="video-frame play" aria-label="Play clip" onClick={onPlay}>
					{state.posterUrl && <img src={state.posterUrl} alt="" />}
					<span className="play-overlay" aria-hidden="true">
						▶
					</span>
					{media.durationSeconds !== null && (
						<span className="duration-badge">{formatDuration(media.durationSeconds)}</span>
					)}
				</button>
			);
		default: {
			const unreachable: never = state;
			return unreachable;
		}
	}
}
