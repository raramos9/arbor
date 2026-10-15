import { useCallback, useRef, useState } from 'react';
import { apply, type ApplyResult, type Command } from '../model/commands';
import type { StrategyDoc } from '../model/strategy';
import { saveStrategy } from '../storage';

export type Editor = {
	doc: StrategyDoc;
	saveError: string | null;
	run: (cmd: Command, opts?: { persist?: boolean }) => ApplyResult;
	persist: () => void;
};

export function useEditor(initial: StrategyDoc): Editor {
	const [doc, setDoc] = useState(initial);
	const [saveError, setSaveError] = useState<string | null>(null);
	const latest = useRef(initial);

	const persist = useCallback(() => {
		const saved = saveStrategy(latest.current);
		setSaveError(saved.ok ? null : saved.error);
	}, []);

	const run = useCallback(
		(cmd: Command, opts?: { persist?: boolean }): ApplyResult => {
			const result = apply(latest.current, cmd);
			if (result.ok) {
				latest.current = result.doc;
				setDoc(result.doc);
				if (opts?.persist !== false) persist();
			}
			return result;
		},
		[persist],
	);

	return { doc, saveError, run, persist };
}
