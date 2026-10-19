import { z } from 'zod';
import { referencedClipIds } from './media';
import { ClipIdSchema, parseStrategy, type ClipId, type Result, type StrategyDoc } from './strategy';

const EncodedBlobSchema = z.object({ type: z.string(), base64: z.string() });

const ExportedClipSchema = z.object({
	id: ClipIdSchema,
	createdAt: z.string(),
	blob: EncodedBlobSchema,
	poster: EncodedBlobSchema.nullable(),
});

const ArborFileSchema = z.object({
	format: z.literal('arbor.strategy'),
	version: z.literal(1),
	strategy: z.unknown(),
	clips: z.array(ExportedClipSchema),
});

export type ExportedClip = z.infer<typeof ExportedClipSchema>;
export type ArborFile = { format: 'arbor.strategy'; version: 1; strategy: StrategyDoc; clips: ExportedClip[] };

export type ImportPlan = { kind: 'new' } | { kind: 'unchanged' } | { kind: 'replace'; existingTitle: string | null };

export function parseArborFile(text: string): Result<ArborFile> {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return { ok: false, error: 'the file is not valid JSON' };
	}
	const parsed = ArborFileSchema.safeParse(json);
	if (!parsed.success) {
		const reason = parsed.error.issues.map((i) => `${i.path.join('.') || 'file'}: ${i.message}`).join('; ');
		return { ok: false, error: reason };
	}
	const strategy = parseStrategy(parsed.data.strategy);
	if (!strategy.ok) return strategy;
	const referenced = referencedClipIds([strategy.value]);
	return {
		ok: true,
		value: {
			format: parsed.data.format,
			version: parsed.data.version,
			strategy: strategy.value,
			clips: parsed.data.clips.filter((clip) => referenced.has(clip.id)),
		},
	};
}

export function clipsToSave(file: ArborFile, existing: readonly ClipId[]): ExportedClip[] {
	return file.clips.filter((clip) => !existing.includes(clip.id));
}

export function planImport(incoming: StrategyDoc, existing: Result<StrategyDoc> | null): ImportPlan {
	if (existing === null) return { kind: 'new' };
	if (!existing.ok) return { kind: 'replace', existingTitle: null };
	if (JSON.stringify(existing.value) === JSON.stringify(incoming)) return { kind: 'unchanged' };
	return { kind: 'replace', existingTitle: existing.value.title };
}

export function exportFileName(doc: StrategyDoc): string {
	const slug = doc.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `${slug || 'strategy'}.arbor.json`;
}
