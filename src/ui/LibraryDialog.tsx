import { useEffect, useState } from 'react';
import { searchLibrary, type LibraryTechnique, type TechniqueDraft } from '../model/library';
import { NodeKindSchema, type LibraryTechniqueId } from '../model/strategy';
import { Field, SelectField } from './Field';
import type { MyLibrary } from './useMyLibrary';

type Props = {
	library: MyLibrary;
	onPick: (technique: LibraryTechnique) => void;
	onCancel: () => void;
};

type Mode = { type: 'list' } | { type: 'form'; editing: LibraryTechnique | null; name: string };

function toDraft(technique: LibraryTechnique | null, name: string): TechniqueDraft {
	if (!technique) return { kind: 'technique', name, description: '', aliases: '', tags: '', media: [] };
	return {
		kind: technique.kind,
		name: technique.name,
		description: technique.description,
		aliases: technique.aliases.join(', '),
		tags: technique.tags.join(', '),
		media: technique.media,
	};
}

export function LibraryDialog({ library, onPick, onCancel }: Props) {
	const [query, setQuery] = useState('');
	const [mode, setMode] = useState<Mode>({ type: 'list' });
	const [confirming, setConfirming] = useState<LibraryTechniqueId | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const results = searchLibrary(library.all, query);
	const mineIds = new Set(library.mine.map((t) => t.id));
	const trimmed = query.trim();

	function back() {
		if (mode.type === 'form') setMode({ type: 'list' });
		else onCancel();
	}

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (mode.type === 'form') setMode({ type: 'list' });
			else onCancel();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode.type, onCancel]);

	function openForm(editing: LibraryTechnique | null, name: string) {
		setConfirming(null);
		setActionError(null);
		setMode({ type: 'form', editing, name });
	}

	function save(draft: TechniqueDraft): string | null {
		if (mode.type !== 'form') return null;
		const saved = mode.editing ? library.update(mode.editing.id, draft) : library.add(draft);
		if (!saved.ok) return saved.error;
		setQuery(draft.name.trim());
		setMode({ type: 'list' });
		return null;
	}

	function remove(id: LibraryTechniqueId) {
		const removed = library.remove(id);
		setConfirming(null);
		setActionError(removed.ok ? null : removed.error);
	}

	return (
		<div className="backdrop" onMouseDown={back}>
			<div className="dialog library-dialog" onMouseDown={(e) => e.stopPropagation()}>
				{mode.type === 'form' ? (
					<LibraryForm
						key={mode.editing?.id ?? 'new'}
						initial={toDraft(mode.editing, mode.name)}
						title={mode.editing ? 'Edit entry' : 'New entry'}
						onSave={save}
						onCancel={() => setMode({ type: 'list' })}
					/>
				) : (
					<form
						className="form"
						onSubmit={(e) => {
							e.preventDefault();
							const first = results[0];
							if (first) onPick(first);
						}}
					>
						<h2>From library</h2>
						{library.loadError && <p className="error">{library.loadError}</p>}
						<input
							autoFocus
							type="search"
							placeholder="Search positions, techniques, submissions"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						{actionError && <p className="error">{actionError}</p>}
						<div className="library-results">
							{results.length === 0 && (
								<>
									<p className="muted">
										Nothing matches. You can still add a custom node with the toolbar buttons.
									</p>
									{trimmed && (
										<button type="button" onClick={() => openForm(null, trimmed)}>
											Add "{trimmed}" to your library
										</button>
									)}
								</>
							)}
							{NodeKindSchema.options.map((kind) => {
								const group = results.filter((t) => t.kind === kind);
								if (group.length === 0) return null;
								return (
									<section key={kind}>
										<h3>{kind}</h3>
										{group.map((technique) => {
											const row = (
												<button
													type="button"
													key={technique.id}
													className="library-row"
													onClick={() => onPick(technique)}
												>
													{technique.name}
													{technique.aliases.length > 0 && (
														<span className="muted"> {technique.aliases.join(', ')}</span>
													)}
												</button>
											);
											if (!mineIds.has(technique.id)) return row;
											return (
												<div key={technique.id} className="library-entry">
													{confirming === technique.id ? (
														<>
															<span className="library-confirm">Delete {technique.name}?</span>
															<button
																type="button"
																className="danger"
																onClick={() => remove(technique.id)}
															>
																Delete
															</button>
															<button type="button" onClick={() => setConfirming(null)}>
																Keep
															</button>
														</>
													) : (
														<>
															{row}
															<span className="library-tag">yours</span>
															<button type="button" onClick={() => openForm(technique, '')}>
																Edit
															</button>
															<button
																type="button"
																className="danger"
																onClick={() => setConfirming(technique.id)}
															>
																Delete
															</button>
														</>
													)}
												</div>
											);
										})}
									</section>
								);
							})}
						</div>
						<div className="row">
							<button type="button" onClick={() => openForm(null, trimmed)}>
								New entry
							</button>
							<button type="button" onClick={onCancel}>
								Cancel
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

type FormProps = {
	initial: TechniqueDraft;
	title: string;
	onSave: (draft: TechniqueDraft) => string | null;
	onCancel: () => void;
};

function LibraryForm({ initial, title, onSave, onCancel }: FormProps) {
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const patch = (next: Partial<TechniqueDraft>) => setDraft((prev) => ({ ...prev, ...next }));

	return (
		<form
			className="form"
			onSubmit={(e) => {
				e.preventDefault();
				setError(onSave(draft));
			}}
		>
			<h2>{title}</h2>
			<SelectField
				label="Kind"
				value={draft.kind}
				options={NodeKindSchema.options}
				onChange={(kind) => patch({ kind: NodeKindSchema.parse(kind) })}
			/>
			<Field label="Name" autoFocus value={draft.name} onChange={(name) => patch({ name })} />
			<Field
				label="Description"
				multiline
				value={draft.description}
				onChange={(description) => patch({ description })}
			/>
			<Field
				label="Other names (comma-separated)"
				value={draft.aliases}
				onChange={(aliases) => patch({ aliases })}
			/>
			<Field label="Tags (comma-separated)" value={draft.tags} onChange={(tags) => patch({ tags })} />
			{error && <p className="error">{error}</p>}
			<div className="row">
				<button type="button" onClick={onCancel}>
					Cancel
				</button>
				<button type="submit">Save</button>
			</div>
		</form>
	);
}
