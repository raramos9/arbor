import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { deleteClip, listClipIds } from '../clips';
import { importStrategy, readArborFile } from '../exchange';
import { planImport, type ArborFile } from '../model/exchange';
import { unreferencedClips } from '../model/media';
import { createStrategy, RulesetSchema, SideSchema, type Ruleset, type Side, type StrategyDoc } from '../model/strategy';
import { editorHref, navigate } from '../route';
import { hasStrategy, listStrategies, loadStrategy, saveStrategy } from '../storage';
import { cloud } from '../supabase';
import { AccountControl } from './AccountControl';

type ImportState =
	| { kind: 'idle' }
	| { kind: 'confirming'; file: ArborFile; existingTitle: string | null }
	| { kind: 'error'; message: string };

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
	const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });
	const fileInput = useRef<HTMLInputElement>(null);

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

	async function runImport(file: ArborFile) {
		const imported = await importStrategy(file);
		if (!imported.ok) {
			setImportState({ kind: 'error', message: imported.error });
			return;
		}
		navigate(editorHref(file.strategy.id));
	}

	async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
		const picked = e.target.files?.[0];
		if (fileInput.current) fileInput.current.value = '';
		if (!picked) return;
		const read = await readArborFile(picked);
		if (!read.ok) {
			setImportState({ kind: 'error', message: `This file is not an Arbor strategy: ${read.error}` });
			return;
		}
		const incoming = read.value;
		const existing = hasStrategy(incoming.strategy.id) ? loadStrategy(incoming.strategy.id) : null;
		const plan = planImport(incoming.strategy, existing);
		switch (plan.kind) {
			case 'new':
				setImportState({ kind: 'idle' });
				await runImport(incoming);
				break;
			case 'unchanged':
				navigate(editorHref(incoming.strategy.id));
				break;
			case 'replace':
				setImportState({ kind: 'confirming', file: incoming, existingTitle: plan.existingTitle });
				break;
			default: {
				const unreachable: never = plan;
				throw new Error(String(unreachable));
			}
		}
	}

	return (
		<div className="page">
			<header className="header">
				<h1>Arbor</h1>
				{cloud && <AccountControl client={cloud} />}
			</header>
			<main className="list-layout">
				<section>
					<div className="section-head">
						<h2>Strategies</h2>
						<input
							ref={fileInput}
							type="file"
							accept=".json,application/json"
							hidden
							onChange={(e) => void onPickFile(e)}
						/>
						<button type="button" onClick={() => fileInput.current?.click()}>
							Import
						</button>
					</div>
					{importState.kind === 'error' && <p className="error">{importState.message}</p>}
					{importState.kind === 'confirming' && (
						<div className="confirm">
							<p>
								{importState.existingTitle === null
									? 'A strategy with this id already exists but cannot be read. Replace it with the imported file?'
									: `“${importState.existingTitle}” already exists in this browser. Replace it with the imported file?`}
							</p>
							<div className="row">
								<button type="button" onClick={() => setImportState({ kind: 'idle' })}>
									Cancel
								</button>
								<button
									type="button"
									className="danger"
									onClick={() => {
										const { file } = importState;
										setImportState({ kind: 'idle' });
										void runImport(file);
									}}
								>
									Replace
								</button>
							</div>
						</div>
					)}
					{sorted.length === 0 && <p className="muted">No strategies yet. Create one or import a file.</p>}
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
