import type { ApplyResult, Command } from '../model/commands';
import { RulesetSchema, SideSchema, type StrategyDoc } from '../model/strategy';
import { Field, SelectField } from './Field';
import type { Selection } from './flow';
import { MediaList } from './MediaList';

type Props = {
	doc: StrategyDoc;
	selection: Selection;
	error: string | null;
	focusField: boolean;
	exec: (cmd: Command) => ApplyResult;
	onDeleted: () => void;
};

export function Inspector({ doc, selection, error, focusField, exec, onDeleted }: Props) {
	const node = selection?.type === 'node' ? doc.nodes[selection.id] : undefined;
	const edge = selection?.type === 'edge' ? doc.edges[selection.id] : undefined;

	function remove(cmd: Command) {
		if (exec(cmd).ok) onDeleted();
	}

	return (
		<aside className="inspector">
			{node && (
				<div className="form" key={node.id}>
					<h2>Node</h2>
					<Field
						label="Name"
						value={node.name}
						autoFocus={focusField}
						onChange={(name) => exec({ type: 'updateNode', id: node.id, patch: { name } })}
					/>
					<Field
						label="Notes"
						multiline
						value={node.notes}
						onChange={(notes) => exec({ type: 'updateNode', id: node.id, patch: { notes } })}
					/>
					<MediaList owner={{ type: 'node', id: node.id }} media={node.media} exec={exec} />
					{node.id === doc.rootNodeId ? (
						<p className="muted">This is the start of the strategy.</p>
					) : (
						<button onClick={() => exec({ type: 'setRoot', id: node.id })}>Set as start</button>
					)}
					<button className="danger" onClick={() => remove({ type: 'deleteNode', id: node.id })}>
						Delete node
					</button>
				</div>
			)}
			{edge && (
				<div className="form" key={edge.id}>
					<h2>Connection</h2>
					<p className="muted">
						{doc.nodes[edge.from]?.name || 'Untitled'} to {doc.nodes[edge.to]?.name || 'Untitled'}
					</p>
					<Field
						label="Reaction"
						placeholder="How your opponent reacts"
						value={edge.label}
						autoFocus={focusField}
						onChange={(label) => exec({ type: 'updateEdge', id: edge.id, patch: { label } })}
					/>
					<Field
						label="Notes"
						multiline
						value={edge.notes}
						onChange={(notes) => exec({ type: 'updateEdge', id: edge.id, patch: { notes } })}
					/>
					<MediaList owner={{ type: 'edge', id: edge.id }} media={edge.media} exec={exec} />
					<button className="danger" onClick={() => remove({ type: 'deleteEdge', id: edge.id })}>
						Delete connection
					</button>
				</div>
			)}
			{!node && !edge && (
				<div className="form">
					<h2>Strategy</h2>
					<Field
						label="Title"
						value={doc.title}
						onChange={(title) => exec({ type: 'updateMeta', patch: { title } })}
					/>
					<Field
						label="Description"
						multiline
						value={doc.description}
						onChange={(description) => exec({ type: 'updateMeta', patch: { description } })}
					/>
					<SelectField
						label="Ruleset"
						value={doc.ruleset}
						options={RulesetSchema.options}
						onChange={(v) => exec({ type: 'updateMeta', patch: { ruleset: RulesetSchema.parse(v) } })}
					/>
					<SelectField
						label="Starting side"
						value={doc.startingSide}
						options={SideSchema.options}
						onChange={(v) =>
							exec({ type: 'updateMeta', patch: { startingSide: SideSchema.parse(v) } })
						}
					/>
				</div>
			)}
			{error && <p className="error">{error}</p>}
		</aside>
	);
}
