import { z } from 'zod';
import libraryData from './library.json';
import {
	LibraryTechniqueIdSchema,
	LinkMediaSchema,
	NodeKindSchema,
	type LibraryTechniqueId,
	type LinkMedia,
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

export type TechniqueDraft = {
	kind: NodeKind;
	name: string;
	description: string;
	aliases: string;
	tags: string;
	media: LinkMedia[];
};

export const MY_LIBRARY_SOURCE = 'Added by you';

function splitList(text: string, lowercase: boolean): string[] {
	const seen = new Set<string>();
	const items: string[] = [];
	for (const part of text.split(',')) {
		const item = lowercase ? part.trim().toLowerCase() : part.trim();
		const key = item.toLowerCase();
		if (!item || seen.has(key)) continue;
		seen.add(key);
		items.push(item);
	}
	return items;
}

export function draftToFields(
	draft: TechniqueDraft,
): Result<Omit<LibraryTechnique, 'id' | 'source'>> {
	const name = draft.name.trim();
	if (!name) return { ok: false, error: 'A library entry needs a name.' };
	return {
		ok: true,
		value: {
			kind: draft.kind,
			name,
			description: draft.description.trim(),
			aliases: splitList(draft.aliases, false),
			tags: splitList(draft.tags, true),
			media: draft.media.map((item) => ({ ...item })),
		},
	};
}

function findDuplicate(
	all: readonly LibraryTechnique[],
	kind: NodeKind,
	name: string,
	excludeId: LibraryTechniqueId | null,
): LibraryTechnique | undefined {
	const needle = name.toLowerCase();
	return all.find((t) => t.id !== excludeId && t.kind === kind && t.name.trim().toLowerCase() === needle);
}

function duplicateError(existing: LibraryTechnique): string {
	return `The library already has a ${existing.kind} named "${existing.name}".`;
}

export function addTechnique(
	all: readonly LibraryTechnique[],
	mine: readonly LibraryTechnique[],
	draft: TechniqueDraft,
	id: LibraryTechniqueId,
): Result<{ mine: LibraryTechnique[]; technique: LibraryTechnique }> {
	const fields = draftToFields(draft);
	if (!fields.ok) return fields;
	const existing = findDuplicate(all, fields.value.kind, fields.value.name, null);
	if (existing) return { ok: false, error: duplicateError(existing) };
	const technique: LibraryTechnique = { ...fields.value, id, source: MY_LIBRARY_SOURCE };
	return { ok: true, value: { mine: [...mine, technique], technique } };
}

export function updateTechnique(
	all: readonly LibraryTechnique[],
	mine: readonly LibraryTechnique[],
	id: LibraryTechniqueId,
	draft: TechniqueDraft,
): Result<LibraryTechnique[]> {
	const current = mine.find((t) => t.id === id);
	if (!current) return { ok: false, error: 'Only entries you added can be edited.' };
	const fields = draftToFields(draft);
	if (!fields.ok) return fields;
	const existing = findDuplicate(all, fields.value.kind, fields.value.name, id);
	if (existing) return { ok: false, error: duplicateError(existing) };
	const next: LibraryTechnique = { ...fields.value, id, source: current.source };
	return { ok: true, value: mine.map((t) => (t.id === id ? next : t)) };
}

export function removeTechnique(mine: readonly LibraryTechnique[], id: LibraryTechniqueId): LibraryTechnique[] {
	return mine.filter((t) => t.id !== id);
}
