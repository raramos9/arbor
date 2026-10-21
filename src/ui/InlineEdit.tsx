import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { NodeId } from '../model/strategy';
import type { Selection } from './flow';

export type EditTarget = NonNullable<Selection>;

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

// Returns keyboard focus to the canvas element being edited once its input is gone.
function restoreFocus(target: EditTarget) {
	requestAnimationFrame(() => {
		const kind = target.type === 'node' ? 'node' : 'edge';
		document.querySelector<HTMLElement>(`.react-flow__${kind}[data-id="${target.id}"]`)?.focus();
	});
}

export function InlineInput({ target, initial, className, label, placeholder, tabTo }: Props) {
	const edit = useContext(InlineEditContext);
	const [draft, setDraft] = useState(initial);
	const ref = useRef<HTMLInputElement>(null);
	const settled = useRef(false);
	const draftRef = useRef(initial);

	useEffect(() => {
		let frame = 0;
		let tries = 0;
		let buffered = false;

		// Until the input can take focus, keystrokes would reach <body> and the editor's global
		// shortcuts (Backspace deletes the selection), so take them into the draft instead.
		const capture = (e: globalThis.KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
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
			if (document.activeElement === el) {
				stop();
				if (buffered) el.setSelectionRange(el.value.length, el.value.length);
				else el.select();
				return;
			}
			// React Flow hides a new node until it is measured, and a hidden input can't take focus.
			if (++tries >= MAX_FOCUS_FRAMES) return stop();
			frame = requestAnimationFrame(focus);
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
		if (e.key === 'Enter') {
			e.stopPropagation();
			e.preventDefault();
			settle(() => edit.commit(target, draft));
			restoreFocus(target);
		} else if (e.key === 'Escape') {
			e.stopPropagation();
			settle(edit.cancel);
			restoreFocus(target);
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
