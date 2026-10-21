import { useEffect, useRef, useState } from 'react';
import { POSITIONS, PositionIdSchema, type Position } from '../model/positions';

type Props = {
	value: Position | null;
	onChange: (position: Position | null) => void;
	allowNone: boolean;
};

const OTHER = 'other';
const NONE = '';

export function PositionField({ value, onChange, allowNone }: Props) {
	// Other with no name yet reports null upward, so the choice and the text are kept here until a name exists.
	const [otherChosen, setOtherChosen] = useState(false);
	const [draft, setDraft] = useState<string | null>(null);
	const [seenValue, setSeenValue] = useState(value);
	const focusInput = useRef(false);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!focusInput.current) return;
		focusInput.current = false;
		input.current?.focus();
	});

	// Undo can move the doc to a named position while Other is still chosen here; the doc wins.
	if (value !== seenValue) {
		setSeenValue(value);
		if (value !== null) setOtherChosen(false);
	}

	const isOther = otherChosen || value?.kind === 'other';
	const selected = isOther ? OTHER : value ? value.id : NONE;
	const text = draft ?? (value?.kind === 'other' ? value.name : '');

	function onSelect(choice: string) {
		setDraft(null);
		if (choice === OTHER) {
			focusInput.current = true;
			setOtherChosen(true);
			onChange(null);
			return;
		}
		setOtherChosen(false);
		const id = PositionIdSchema.safeParse(choice);
		onChange(id.success ? { kind: 'listed', id: id.data } : null);
	}

	function onText(next: string) {
		setDraft(next);
		const name = next.trim();
		onChange(name === '' ? null : { kind: 'other', name });
	}

	return (
		<>
			<label>
				Starting position
				<select value={selected} onChange={(e) => onSelect(e.target.value)}>
					{allowNone && <option value={NONE}>Not set</option>}
					{POSITIONS.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
					<option value={OTHER}>Other…</option>
				</select>
			</label>
			{isOther && (
				<label>
					Position name
					<input
						ref={input}
						value={text}
						maxLength={60}
						onChange={(e) => onText(e.target.value)}
						onBlur={() => setDraft(null)}
					/>
				</label>
			)}
		</>
	);
}
