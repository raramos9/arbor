import { useState } from 'react';

type Props = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	placeholder?: string;
};

export function Field({ label, value, onChange, multiline, placeholder }: Props) {
	// While focused the field shows what was typed; otherwise it follows the doc, so undo shows up.
	const [draft, setDraft] = useState<string | null>(null);
	const shared = {
		value: draft ?? value,
		onChange: (e: { target: { value: string } }) => {
			setDraft(e.target.value);
			onChange(e.target.value);
		},
		onBlur: () => setDraft(null),
	};
	return (
		<label>
			{label}
			{multiline ? (
				<textarea rows={6} placeholder={placeholder} {...shared} />
			) : (
				<input {...shared} placeholder={placeholder} />
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

export function ReadField({ label, value }: { label: string; value: string }) {
	return (
		<div className="read-field">
			<span className="read-label">{label}</span>
			<p className="read-text">{value}</p>
		</div>
	);
}
