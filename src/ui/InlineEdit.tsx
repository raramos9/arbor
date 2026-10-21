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

export function InlineInput({ target, initial, className, label, placeholder, tabTo }: Props) {
	const edit = useContext(InlineEditContext);
	const [draft, setDraft] = useState(initial);
	const ref = useRef<HTMLInputElement>(null);
	const settled = useRef(false);

	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
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
		} else if (e.key === 'Escape') {
			e.stopPropagation();
			settle(edit.cancel);
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
			onChange={(e) => setDraft(e.target.value)}
			onKeyDown={onKeyDown}
			onBlur={() => settle(() => edit.commit(target, draft))}
		/>
	);
}
