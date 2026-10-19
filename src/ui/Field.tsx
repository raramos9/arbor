import { useState } from 'react';

type Props = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	autoFocus?: boolean;
	placeholder?: string;
};

export function Field({ label, value, onChange, multiline, autoFocus, placeholder }: Props) {
	const [draft, setDraft] = useState(value);
	const shared = {
		value: draft,
		onChange: (e: { target: { value: string } }) => {
			setDraft(e.target.value);
			onChange(e.target.value);
		},
		onBlur: () => setDraft(value),
	};
	return (
		<label>
			{label}
			{multiline ? (
				<textarea rows={6} placeholder={placeholder} {...shared} />
			) : (
				<input
					{...shared}
					placeholder={placeholder}
					autoFocus={autoFocus}
					onFocus={autoFocus ? (e) => e.target.select() : undefined}
				/>
			)}
		</label>
	);
}

type SelectProps<T extends string> = {
	label: string;
	value: T;
	options: readonly T[];
	onChange: (value: string) => void;
};

export function SelectField<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
	return (
		<label>
			{label}
			<select value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map((o) => (
					<option key={o}>{o}</option>
				))}
			</select>
		</label>
	);
}
