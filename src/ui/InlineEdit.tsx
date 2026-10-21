import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { NodeId } from '../model/strategy';
import type { Selection } from './flow';

export type EditTarget = Exclude<NonNullable<Selection>, { type: 'reaction' }>;

export type InlineEdit = {
	start: (target: EditTarget) => void;
	commit: (target: EditTarget, text: string) => void;
	cancel: () => void;
};

export const noInlineEdit: InlineEdit = { start: () => {}, commit: () => {}, cancel: () => {} };

export const InlineEditContext = createContext<InlineEdit>(noInlineEdit);

type Props = {
	target: EditTarget;
	initial: string;
	className: string;
	label: string;
	placeholder?: string;
	tabTo?: NodeId;
};

// About one second of frames.
const MAX_FOCUS_FRAMES = 60;

const MAX_RESTORE_FRAMES = 10;

// Returns keyboard focus to the canvas element being edited once its input is gone. React Flow can
// remount the edge layer right after a new node is measured, so keep trying while focus sits on <body>.
function restoreFocus(target: EditTarget) {
	const kind = target.type === 'node' ? 'node' : 'edge';
	let tries = 0;
	const attempt = () => {
		const el = document.querySelector<HTMLElement>(`.react-flow__${kind}[data-id="${target.id}"]`);
		el?.focus();
		const landed = el !== null && document.activeElement === el;
		if (!landed && document.activeElement === document.body && ++tries < MAX_RESTORE_FRAMES) {
			requestAnimationFrame(attempt);
		}
	};
	requestAnimationFrame(attempt);
}

export function InlineInput({ target, initial, className, label, placeholder, tabTo }: Props) {
	const edit = useContext(InlineEditContext);
	const [draft, setDraft] = useState(initial);
	const ref = useRef<HTMLInputElement>(null);
	const settled = useRef(false);
	const draftRef = useRef(initial);
	const finish = useRef((_key: 'Enter' | 'Escape') => {});
	finish.current = (key) => {
		if (key === 'Enter') settle(() => edit.commit(target, draftRef.current));
		else settle(edit.cancel);
		restoreFocus(target);
	};

	useEffect(() => {
		let frame = 0;
		let tries = 0;
		let buffered = false;
		let pending: 'Enter' | 'Escape' | null = null;

		// Until the input can take focus, keystrokes would reach <body> and the editor's global
		// shortcuts (Backspace deletes the selection), so take them into the draft instead.
		const capture = (e: globalThis.KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			// Enter or Escape typed this early ends the edit as soon as the input exists, as it would have.
			if (e.key === 'Enter' || e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				pending = e.key;
				stop();
				return;
			}
			const printable = e.key.length === 1;
			if (!printable && e.key !== 'Backspace' && e.key !== 'Delete') return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === 'Delete') return;
			// The first keystroke replaces the initial text, as it would over the select-all.
			const base = buffered ? draftRef.current : '';
			buffered = true;
			draftRef.current = printable ? base + e.key : base.slice(0, -1);
			setDraft(draftRef.current);
		};
		window.addEventListener('keydown', capture, true);
		const stop = () => window.removeEventListener('keydown', capture, true);

		const focus = () => {
			const el = ref.current;
			if (!el) return stop();
			el.focus();
			const focused = document.activeElement === el;
			// React Flow hides a new node until it is measured, and a hidden input can't take focus.
			if (!focused && ++tries < MAX_FOCUS_FRAMES) {
				frame = requestAnimationFrame(focus);
				return;
			}
			stop();
			if (pending) return finish.current(pending);
			if (!focused) return;
			if (buffered) el.setSelectionRange(el.value.length, el.value.length);
			else el.select();
		};
		focus();
		return () => {
			stop();
			cancelAnimationFrame(frame);
		};
	}, []);

	// Enter, Tab and the blur that follows unmounting must not each commit.
	function settle(action: () => void) {
		if (settled.current) return;
		settled.current = true;
		action();
	}

	function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === 'Escape') {
			e.stopPropagation();
			e.preventDefault();
			finish.current(e.key);
		} else if (e.key === 'Tab' && !e.shiftKey && tabTo) {
			e.preventDefault();
			settle(() => {
				edit.commit(target, draft);
				edit.start({ type: 'node', id: tabTo });
			});
		}
	}

	return (
		<input
			ref={ref}
			className={`${className} nodrag nopan`}
			aria-label={label}
			placeholder={placeholder}
			value={draft}
			onChange={(e) => {
				draftRef.current = e.target.value;
				setDraft(e.target.value);
			}}
			onKeyDown={onKeyDown}
			onBlur={() => settle(() => edit.commit(target, draft))}
		/>
	);
}
