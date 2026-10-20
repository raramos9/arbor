import { useCallback, useRef, useState } from 'react';
import { apply, type ApplyResult, type Command } from '../model/commands';
import type { StrategyDoc } from '../model/strategy';
import { saveStrategy } from '../storage';
import { History } from './history';

export type Editor = {
	doc: StrategyDoc;
	saveError: string | null;
	run: (cmd: Command, opts?: { persist?: boolean }) => ApplyResult;
	persist: () => void;
	undo: () => boolean;
	redo: () => boolean;
	canUndo: boolean;
	canRedo: boolean;
};

export function useEditor(initial: StrategyDoc): Editor {
	const [doc, setDoc] = useState(initial);
	const [saveError, setSaveError] = useState<string | null>(null);
	const latest = useRef(initial);
	const history = useRef(new History());
	const [, setHistoryVersion] = useState(0);

	const persist = useCallback(() => {
		const saved = saveStrategy(latest.current);
		setSaveError(saved.ok ? null : saved.error);
	}, []);

	const show = useCallback(
		(next: StrategyDoc) => {
			latest.current = next;
			setDoc(next);
			setHistoryVersion((v) => v + 1);
		},
		[],
	);

	const run = useCallback(
		(cmd: Command, opts?: { persist?: boolean }): ApplyResult => {
			const before = latest.current;
			const result = apply(before, cmd);
			if (result.ok) {
				history.current.record(before, cmd, Date.now());
				show(result.doc);
				if (opts?.persist !== false) persist();
			}
			return result;
		},
		[persist, show],
	);

	const step = useCallback(
		(direction: 'undo' | 'redo'): boolean => {
			const restored = history.current[direction](latest.current);
			if (!restored) return false;
			show({ ...restored, updatedAt: new Date().toISOString() });
			persist();
			return true;
		},
		[persist, show],
	);

	const undo = useCallback(() => step('undo'), [step]);
	const redo = useCallback(() => step('redo'), [step]);

	return {
		doc,
		saveError,
		run,
		persist,
		undo,
		redo,
		canUndo: history.current.canUndo,
		canRedo: history.current.canRedo,
	};
}
