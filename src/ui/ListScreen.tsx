import { useEffect, useState, type FormEvent } from 'react';
import { deleteClip, listClipIds } from '../clips';
import { unreferencedClips } from '../model/media';
import { createStrategy, RulesetSchema, SideSchema, type Ruleset, type Side, type StrategyDoc } from '../model/strategy';
import { editorHref, navigate } from '../route';
import { listStrategies, saveStrategy } from '../storage';

async function collectClips(docs: StrategyDoc[]) {
	const listed = await listClipIds();
	if (!listed.ok) return;
	for (const id of unreferencedClips(docs, listed.value)) await deleteClip(id);
}

export function ListScreen() {
	const [entries] = useState(listStrategies);
	const [title, setTitle] = useState('');
	const [rootName, setRootName] = useState('');
	const [ruleset, setRuleset] = useState<Ruleset>('both');
	const [side, setSide] = useState<Side>('bottom');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const docs = entries.flatMap((entry) => (entry.ok ? [entry.doc] : []));
		if (docs.length !== entries.length) return;
		void collectClips(docs);
	}, [entries]);

	const valid = title.trim() !== '' && rootName.trim() !== '';
	const sorted = [...entries].sort((a, b) => {
		if (!a.ok || !b.ok) return Number(a.ok) - Number(b.ok);
		return b.doc.updatedAt.localeCompare(a.doc.updatedAt);
	});

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!valid) return;
		const doc = createStrategy({
			title: title.trim(),
			rootName: rootName.trim(),
			ruleset,
			startingSide: side,
		});
		const saved = saveStrategy(doc);
		if (!saved.ok) {
			setError(saved.error);
			return;
		}
		navigate(editorHref(doc.id));
	}

	return (
		<div className="page">
			<header className="header">
				<h1>Arbor</h1>
			</header>
			<main className="list-layout">
				<section>
					<h2>Strategies</h2>
					{sorted.length === 0 && <p className="muted">No strategies yet. Create one to start.</p>}
					<ul className="strategy-list">
						{sorted.map((entry) =>
							entry.ok ? (
								<li key={entry.id}>
									<a href={editorHref(entry.id)}>
										<strong>{entry.doc.title || 'Untitled'}</strong>
										<span className="muted">
											{entry.doc.ruleset} · starts {entry.doc.startingSide}
										</span>
									</a>
								</li>
							) : (
								<li key={entry.id} className="corrupt">
									<a href={editorHref(entry.id)}>
										<strong>Unreadable strategy</strong>
										<span className="muted">{entry.id}</span>
									</a>
								</li>
							),
						)}
					</ul>
				</section>
				<section>
					<h2>New strategy</h2>
					<form className="form" onSubmit={onSubmit}>
						<label>
							Title
							<input value={title} onChange={(e) => setTitle(e.target.value)} />
						</label>
						<label>
							Starting position
							<input value={rootName} onChange={(e) => setRootName(e.target.value)} placeholder="Open guard" />
						</label>
						<label>
							Ruleset
							<select value={ruleset} onChange={(e) => setRuleset(RulesetSchema.parse(e.target.value))}>
								{RulesetSchema.options.map((o) => (
									<option key={o}>{o}</option>
								))}
							</select>
						</label>
						<label>
							Starting side
							<select value={side} onChange={(e) => setSide(SideSchema.parse(e.target.value))}>
								{SideSchema.options.map((o) => (
									<option key={o}>{o}</option>
								))}
							</select>
						</label>
						{error && <p className="error">{error}</p>}
						<button type="submit" disabled={!valid}>
							New strategy
						</button>
					</form>
				</section>
			</main>
		</div>
	);
}
