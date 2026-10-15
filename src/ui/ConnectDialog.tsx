import { useState } from 'react';
import { defaultActor, type Command, type EdgeActor } from '../model/commands';
import { parseReaction, type StrategyNode } from '../model/strategy';

type Move = Extract<Command, { type: 'connect' }>['move'];

type Props = {
	from: StrategyNode;
	to: StrategyNode;
	onCreate: (move: Move) => string | null;
	onCancel: () => void;
};

export function ConnectDialog({ from, to, onCreate, onCancel }: Props) {
	const [actor, setActor] = useState<EdgeActor>(defaultActor(from.kind));
	const [label, setLabel] = useState('');
	const [error, setError] = useState<string | null>(null);
	const reaction = parseReaction(label);
	const canCreate = actor === 'me' || reaction !== null;

	function submit() {
		const move: Move | null =
			actor === 'me' ? { actor, label } : reaction ? { actor, label: reaction } : null;
		if (!move) return;
		setError(onCreate(move));
	}

	return (
		<div className="backdrop" onMouseDown={onCancel}>
			<form
				className="dialog form"
				onMouseDown={(e) => e.stopPropagation()}
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<h2>Connect</h2>
				<p className="muted">
					{from.name || 'Untitled'} to {to.name || 'Untitled'}
				</p>
				<label>
					Who moves
					<select value={actor} onChange={(e) => setActor(e.target.value === 'opponent' ? 'opponent' : 'me')}>
						<option value="me">me</option>
						<option value="opponent">opponent</option>
					</select>
				</label>
				<label>
					{actor === 'opponent' ? 'Reaction (required)' : 'Label (optional)'}
					<input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
				</label>
				{error && <p className="error">{error}</p>}
				<div className="row">
					<button type="button" onClick={onCancel}>
						Cancel
					</button>
					<button type="submit" disabled={!canCreate}>
						Create
					</button>
				</div>
			</form>
		</div>
	);
}
