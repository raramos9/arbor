import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { deleteClip, listClipIds } from '../clips';
import { importStrategy, readArborFile } from '../exchange';
import { planImport, type ArborFile } from '../model/exchange';
import { unreferencedClips } from '../model/media';
import { positionName, startLabel, type PositionId } from '../model/positions';
import type { StrategyDoc } from '../model/strategy';
import { editorHref, navigate } from '../route';
import { hasStrategy, listStrategies, loadStrategy } from '../storage';
import { AppHeader } from './AppHeader';
import { ImportIcon, PlusIcon } from './Icons';
import { CardPreview } from './CardPreview';
import { miniTree, plural, RULESET_LABEL, strategyStats, timeAgo } from './miniTree';
import { MiniTreeView } from './MiniTreeView';
import { NewStrategyDialog } from './NewStrategyDialog';
import { toOutline } from './outline';

const DEFAULT_POSITION: PositionId = 'closed-guard';

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
	const [creating, setCreating] = useState<PositionId | null>(null);
	const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });
	const fileInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const docs = entries.flatMap((entry) => (entry.ok ? [entry.doc] : []));
		if (docs.length !== entries.length) return;
		void collectClips(docs);
	}, [entries]);

	const sorted = [...entries].sort((a, b) => {
		if (!a.ok || !b.ok) return Number(a.ok) - Number(b.ok);
		return b.doc.updatedAt.localeCompare(a.doc.updatedAt);
	});

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
			<AppHeader current="strategies" />
			<main className="shelf-page">
				<div className="page-head">
					<div className="page-title">
						<h1>Your strategies</h1>
						<p className="muted">Saved in this browser.</p>
					</div>
					<div className="page-actions">
						<input
							ref={fileInput}
							type="file"
							accept=".json,application/json"
							hidden
							onChange={(e) => void onPickFile(e)}
						/>
						<button type="button" className="with-icon" onClick={() => fileInput.current?.click()}>
							<ImportIcon />
							Import
						</button>
						<button type="button" className="primary with-icon" onClick={() => setCreating(DEFAULT_POSITION)}>
							<PlusIcon />
							New strategy
						</button>
					</div>
				</div>
				{importState.kind === 'error' && <p className="banner error">{importState.message}</p>}
				{importState.kind === 'confirming' && (
					<div className="banner">
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
				{sorted.length === 0 ? (
					<FirstPlan onStart={setCreating} />
				) : (
					<ul className="card-grid">
						{sorted.map((entry) =>
							entry.ok ? (
								<StrategyCard key={entry.id} doc={entry.doc} />
							) : (
								<li key={entry.id} className="card corrupt">
									<a href={editorHref(entry.id)} className="card-link">
										<div className="card-body">
											<h2 className="card-title">Unreadable strategy</h2>
											<p className="card-meta">{entry.id}</p>
										</div>
									</a>
								</li>
							),
						)}
						<li className="ghost-cell">
							<button type="button" className="card ghost" onClick={() => setCreating(DEFAULT_POSITION)}>
								<PlusIcon size={16} />
								New strategy
							</button>
						</li>
					</ul>
				)}
			</main>
			{creating && <NewStrategyDialog initial={creating} onClose={() => setCreating(null)} />}
		</div>
	);
}

function StrategyCard({ doc }: { doc: StrategyDoc }) {
	const stats = strategyStats(doc);
	const outline = toOutline(doc);
	const previewId = useId();
	return (
		<li className="card">
			<a href={editorHref(doc.id)} className="card-link">
				<MiniTreeView tree={miniTree(outline)} />
				<div className="card-body">
					<h2 className="card-title">{doc.title || 'Untitled'}</h2>
					<p className="card-start">
						{doc.position ? startLabel(doc.position, doc.startingSide) : `Starts ${doc.startingSide}`}
						{` · ${RULESET_LABEL[doc.ruleset]}`}
						{doc.origin && ` · fork of @${doc.origin.handle}`}
					</p>
					<CardPreview id={previewId} outline={outline} />
					<p className="card-meta">
						<span>
							{plural(stats.steps, 'step')} · {plural(stats.reactions, 'reaction')}
						</span>
						<span>{timeAgo(doc.updatedAt)}</span>
					</p>
				</div>
			</a>
		</li>
	);
}

const QUICK_STARTS: PositionId[] = ['closed-guard', 'half-guard', 'standing', 'side-control', 'mount', 'back'];

function FirstPlan({ onStart }: { onStart: (position: PositionId) => void }) {
	return (
		<section className="first-plan" aria-labelledby="first-plan-title">
			<h2 id="first-plan-title">Map your first game plan</h2>
			<p className="muted">
				Pick where it starts, then add what you try and how your opponent reacts, until each line ends.
			</p>
			<div className="chips">
				{QUICK_STARTS.map((id) => (
					<button key={id} type="button" className="chip" onClick={() => onStart(id)}>
						{positionName({ kind: 'listed', id })}
					</button>
				))}
				<button type="button" className="chip" onClick={() => onStart(DEFAULT_POSITION)}>
					Other position…
				</button>
			</div>
		</section>
	);
}
