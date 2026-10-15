export type VideoInfo = { poster: Blob | null; durationSeconds: number | null };

const MAX_POSTER_WIDTH = 640;
const POSTER_QUALITY = 0.8;
const SEEK_FRACTION = 0.1;
const MAX_SEEK_SECONDS = 1;
const TIMEOUT_MS = 8000;

const NONE: VideoInfo = { poster: null, durationSeconds: null };

function waitFor(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<boolean> {
	return new Promise((resolve) => {
		const finish = (ok: boolean) => {
			clearTimeout(timer);
			video.removeEventListener(event, onDone);
			video.removeEventListener('error', onError);
			resolve(ok);
		};
		const onDone = () => finish(true);
		const onError = () => finish(false);
		const timer = setTimeout(() => finish(false), TIMEOUT_MS);
		video.addEventListener(event, onDone);
		video.addEventListener('error', onError);
	});
}

function drawPoster(video: HTMLVideoElement): Promise<Blob | null> {
	const width = Math.min(video.videoWidth, MAX_POSTER_WIDTH);
	if (width === 0 || video.videoHeight === 0) return Promise.resolve(null);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = Math.round((video.videoHeight * width) / video.videoWidth);
	const context = canvas.getContext('2d');
	if (!context) return Promise.resolve(null);
	context.drawImage(video, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', POSTER_QUALITY));
}

export async function readVideo(source: Blob): Promise<VideoInfo> {
	const url = URL.createObjectURL(source);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'metadata';
	try {
		const loaded = waitFor(video, 'loadedmetadata');
		video.src = url;
		if (!(await loaded)) return NONE;
		const durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
		if (durationSeconds === null) return NONE;
		const seeked = waitFor(video, 'seeked');
		video.currentTime = Math.min(MAX_SEEK_SECONDS, durationSeconds * SEEK_FRACTION);
		if (!(await seeked)) return { poster: null, durationSeconds };
		return { poster: await drawPoster(video), durationSeconds };
	} catch {
		return NONE;
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(url);
	}
}
