import { useState, type FormEvent } from 'react';
import { canonicalPosition, POSITIONS, pairSide, positionName, sideAfterPositionChange, type Position, type PositionId } from '../model/positions';
import { createStrategy, RulesetSchema, SideSchema, type Result, type Ruleset, type Side } from '../model/strategy';
import { editorHref, navigate } from '../route';
import { saveStrategy } from '../storage';
import { Dialog } from './Dialog';

const OTHER = 'other';

const SIDE_LABEL: Record<Side, string> = { top: 'Top', bottom: 'Bottom', standing: 'Standing' };
const RULESET_LABEL: Record<Ruleset, string> = { gi: 'Gi', 'no-gi': 'No-gi', both: 'Both' };

export function openNewStrategy(args: Parameters<typeof createStrategy>[0]): Result<null> {
	const choice = args.position?.kind === 'listed' ? args.position.id : 'other';
	const doc = createStrategy({ ...args, startingSide: pairSide(args.startingSide, choice) });
	const saved = saveStrategy(doc);
	if (saved.ok) navigate(editorHref(doc.id));
	return saved;
}

export function NewStrategyDialog({ initial, onClose }: { initial: PositionId; onClose: () => void }) {
	const [choice, setChoice] = useState<PositionId | typeof OTHER>(initial);
	const [otherName, setOtherName] = useState('');
	const [side, setSide] = useState<Side>(sideAfterPositionChange('bottom', initial));
	const [ruleset, setRuleset] = useState<Ruleset>('both');
	const [typedTitle, setTypedTitle] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const position: Position | null =
		choice === OTHER
			? otherName.trim() === ''
				? null
				: canonicalPosition({ kind: 'other', name: otherName.trim() })
			: { kind: 'listed', id: choice };
	// A typed name matching a listed position follows that position's side rule.
	const effective = position?.kind === 'listed' ? position.id : choice;
	const startSide = pairSide(side, effective);
	// Until the user types a title, it follows the chosen position so Create is ready once one is picked.
	const suggestedTitle = position ? `${positionName(position)} game plan` : '';
	const title = typedTitle ?? suggestedTitle;
	const valid = title.trim() !== '' && position !== null;

	function choose(next: PositionId | typeof OTHER) {
		setChoice(next);
		setSide((current) => sideAfterPositionChange(current, next));
	}

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!valid || !position) return;
		const opened = openNewStrategy({ title: title.trim(), position, ruleset, startingSide: startSide });
		if (opened.ok) onClose();
		else setError(opened.error);
	}

	return (
		<Dialog label="New strategy" onClose={onClose} wide>
			<form className="form new-strategy" onSubmit={onSubmit}>
				<h2>New strategy</h2>
				<label>
					Title
					<input
						value={title}
						placeholder="Name this game plan"
						data-autofocus=""
						onFocus={(e) => {
							if (typedTitle === null) e.target.select();
						}}
						onChange={(e) => setTypedTitle(e.target.value)}
					/>
				</label>
				<fieldset className="choice">
					<legend>Where does it start?</legend>
					<div className="chips">
						{POSITIONS.map((p) => (
							<label key={p.id} className="chip">
								<input
									type="radio"
									name="position"
									value={p.id}
									checked={choice === p.id}
									onChange={() => choose(p.id)}
								/>
								<span>{p.name}</span>
							</label>
						))}
						<label className="chip">
							<input
								type="radio"
								name="position"
								value={OTHER}
								checked={choice === OTHER}
								onChange={() => choose(OTHER)}
							/>
							<span>Other…</span>
						</label>
					</div>
					{choice === OTHER && (
						<label>
							Position name
							<input value={otherName} maxLength={60} autoFocus onChange={(e) => setOtherName(e.target.value)} />
						</label>
					)}
				</fieldset>
				<div className="choice-row">
					<fieldset className="choice">
						<legend>You start</legend>
						<div className="segmented">
							{SideSchema.options
								.filter((option) => (effective === 'standing') === (option === 'standing'))
								.map((option) => (
									<label key={option}>
										<input
											type="radio"
											name="side"
											value={option}
											checked={startSide === option}
											onChange={() => setSide(option)}
										/>
										<span>{SIDE_LABEL[option]}</span>
									</label>
								))}
						</div>
					</fieldset>
					<fieldset className="choice">
						<legend>Ruleset</legend>
						<div className="segmented">
							{RulesetSchema.options.map((option) => (
								<label key={option}>
									<input
										type="radio"
										name="ruleset"
										value={option}
										checked={ruleset === option}
										onChange={() => setRuleset(option)}
									/>
									<span>{RULESET_LABEL[option]}</span>
								</label>
							))}
						</div>
					</fieldset>
				</div>
				{error && <p className="error">{error}</p>}
				<div className="row">
					{!valid && position === null && <p className="muted hint">Name the position to create it.</p>}
					<button type="button" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className="primary" disabled={!valid}>
						Create strategy
					</button>
				</div>
			</form>
		</Dialog>
	);
}
