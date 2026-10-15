import { useEffect, useState } from 'react';
import { LIBRARY, searchLibrary, type LibraryTechnique } from '../model/library';
import { NodeKindSchema } from '../model/strategy';

type Props = {
	onPick: (technique: LibraryTechnique) => void;
	onCancel: () => void;
};

export function LibraryDialog({ onPick, onCancel }: Props) {
	const [query, setQuery] = useState('');
	const results = searchLibrary(LIBRARY, query);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onCancel();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onCancel]);

	return (
		<div className="backdrop" onMouseDown={onCancel}>
			<form
				className="dialog library-dialog form"
				onMouseDown={(e) => e.stopPropagation()}
				onSubmit={(e) => {
					e.preventDefault();
					const first = results[0];
					if (first) onPick(first);
				}}
			>
				<h2>From library</h2>
				<input
					autoFocus
					type="search"
					placeholder="Search positions, techniques, submissions"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<div className="library-results">
					{results.length === 0 && (
						<p className="muted">
							Nothing matches. You can still add a custom node with the toolbar buttons.
						</p>
					)}
					{NodeKindSchema.options.map((kind) => {
						const group = results.filter((t) => t.kind === kind);
						if (group.length === 0) return null;
						return (
							<section key={kind}>
								<h3>{kind}</h3>
								{group.map((technique) => (
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
								))}
							</section>
						);
					})}
				</div>
				<div className="row">
					<button type="button" onClick={onCancel}>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
