import { z } from 'zod';
import libraryData from './library.json';
import {
	LibraryTechniqueIdSchema,
	LinkMediaSchema,
	NodeKindSchema,
	type NodeKind,
	type Result,
} from './strategy';

export const LibraryTechniqueSchema = z.object({
	id: LibraryTechniqueIdSchema,
	kind: NodeKindSchema,
	name: z.string().min(1),
	aliases: z.array(z.string()),
	description: z.string(),
	media: z.array(LinkMediaSchema),
	tags: z.array(z.string()),
	source: z.string(),
});

export type LibraryTechnique = z.infer<typeof LibraryTechniqueSchema>;

const KIND_ORDER: readonly NodeKind[] = NodeKindSchema.options;

export function parseLibrary(input: unknown): Result<LibraryTechnique[]> {
	const parsed = z.array(LibraryTechniqueSchema).safeParse(input);
	if (!parsed.success) {
		const error = parsed.error.issues.map((i) => `${i.path.join('.') || 'library'}: ${i.message}`).join('; ');
		return { ok: false, error };
	}
	const seen = new Set<string>();
	for (const technique of parsed.data) {
		if (seen.has(technique.id)) return { ok: false, error: `duplicate library id ${technique.id}` };
		seen.add(technique.id);
	}
	return { ok: true, value: parsed.data };
}

function loadLibrary(): readonly LibraryTechnique[] {
	const parsed = parseLibrary(libraryData);
	if (!parsed.ok) throw new Error(`Seed library is invalid: ${parsed.error}`);
	return parsed.value;
}

export const LIBRARY: readonly LibraryTechnique[] = loadLibrary();

export function searchLibrary(library: readonly LibraryTechnique[], query: string): LibraryTechnique[] {
	const needle = query.trim().toLowerCase();
	const matches = needle
		? library.filter((t) =>
				[t.name, ...t.aliases, ...t.tags].some((text) => text.toLowerCase().includes(needle)),
			)
		: [...library];
	return matches.sort(
		(a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
	);
}
