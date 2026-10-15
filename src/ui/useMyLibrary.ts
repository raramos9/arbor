import { useMemo, useRef, useState } from 'react';
import {
	LIBRARY,
	addTechnique,
	removeTechnique,
	updateTechnique,
	type LibraryTechnique,
	type TechniqueDraft,
} from '../model/library';
import { LibraryTechniqueIdSchema, type LibraryTechniqueId, type Result } from '../model/strategy';
import { loadMyLibrary, saveMyLibrary } from '../storage';

export type MyLibrary = {
	mine: readonly LibraryTechnique[];
	all: readonly LibraryTechnique[];
	loadError: string | null;
	add: (draft: TechniqueDraft) => Result<LibraryTechnique>;
	update: (id: LibraryTechniqueId, draft: TechniqueDraft) => Result<null>;
	remove: (id: LibraryTechniqueId) => Result<null>;
};

export function useMyLibrary(): MyLibrary {
	const [loaded] = useState(loadMyLibrary);
	const [mine, setMine] = useState<readonly LibraryTechnique[]>(loaded.ok ? loaded.value : []);
	const latest = useRef(mine);
	const all = useMemo(() => [...LIBRARY, ...mine], [mine]);
	const loadError = loaded.ok ? null : loaded.error;

	function commit(next: LibraryTechnique[]): Result<null> {
		const saved = saveMyLibrary(next);
		if (!saved.ok) return saved;
		latest.current = next;
		setMine(next);
		return { ok: true, value: null };
	}

	const everything = () => [...LIBRARY, ...latest.current];

	function add(draft: TechniqueDraft): Result<LibraryTechnique> {
		if (!loaded.ok) return loaded;
		const id = LibraryTechniqueIdSchema.parse(crypto.randomUUID());
		const added = addTechnique(everything(), latest.current, draft, id);
		if (!added.ok) return added;
		const saved = commit(added.value.mine);
		return saved.ok ? { ok: true, value: added.value.technique } : saved;
	}

	function update(id: LibraryTechniqueId, draft: TechniqueDraft): Result<null> {
		if (!loaded.ok) return loaded;
		const updated = updateTechnique(everything(), latest.current, id, draft);
		return updated.ok ? commit(updated.value) : updated;
	}

	function remove(id: LibraryTechniqueId): Result<null> {
		if (!loaded.ok) return loaded;
		return commit(removeTechnique(latest.current, id));
	}

	return { mine, all, loadError, add, update, remove };
}
