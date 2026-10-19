import { getClip, saveClip } from './clips';
import { parseArborFile, type ArborFile, type ExportedClip } from './model/exchange';
import { referencedClipIds } from './model/media';
import type { Result, StrategyDoc } from './model/strategy';
import { saveStrategy } from './storage';

const CHUNK = 0x8000;

function describe(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

export async function encodeBlob(blob: Blob): Promise<{ type: string; base64: string }> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return { type: blob.type, base64: btoa(binary) };
}

export function decodeBlob(encoded: { type: string; base64: string }): Blob {
	const binary = atob(encoded.base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new Blob([bytes], { type: encoded.type });
}

export async function exportStrategy(doc: StrategyDoc): Promise<Result<Blob>> {
	const clips: ExportedClip[] = [];
	try {
		for (const id of referencedClipIds([doc])) {
			const stored = await getClip(id);
			if (!stored.ok) return stored;
			if (stored.value === null) continue;
			const { blob, poster, createdAt } = stored.value;
			clips.push({
				id,
				createdAt,
				blob: await encodeBlob(blob),
				poster: poster && (await encodeBlob(poster)),
			});
		}
	} catch (e) {
		return { ok: false, error: `Could not export: ${describe(e)}` };
	}
	const file: ArborFile = { format: 'arbor.strategy', version: 1, strategy: doc, clips };
	return { ok: true, value: new Blob([JSON.stringify(file)], { type: 'application/json' }) };
}

export async function readArborFile(file: File): Promise<Result<ArborFile>> {
	let text: string;
	try {
		text = await file.text();
	} catch (e) {
		return { ok: false, error: `Could not read the file: ${describe(e)}` };
	}
	return parseArborFile(text);
}

export async function importStrategy(file: ArborFile): Promise<Result<null>> {
	try {
		for (const clip of file.clips) {
			const saved = await saveClip({
				id: clip.id,
				createdAt: clip.createdAt,
				blob: decodeBlob(clip.blob),
				poster: clip.poster && decodeBlob(clip.poster),
			});
			if (!saved.ok) return saved;
		}
	} catch (e) {
		return { ok: false, error: `Could not import: ${describe(e)}` };
	}
	return saveStrategy(file.strategy);
}
