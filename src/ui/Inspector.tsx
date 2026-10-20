import type { ApplyResult, Command } from '../model/commands';
import { RulesetSchema, SideSchema, type StrategyDoc } from '../model/strategy';
import { Field, ReadField, SelectField } from './Field';
import type { Selection } from './flow';
import { MediaList } from './MediaList';

type InspectorAccess =
	| {
			mode: 'edit';
			exec: (cmd: Command) => ApplyResult;
			onDeleted: () => void;
			focusField: boolean;
	  }
	| { mode: 'view' };

type Props = {
	doc: StrategyDoc;
	selection: Selection;
	error: string | null;
	access: InspectorAccess;
};

export function Inspector({ doc, selection, error, access }: Props) {
	const node = selection?.type === 'node' ? doc.nodes[selection.id] : undefined;
	const edge = selection?.type === 'edge' ? doc.edges[selection.id] : undefined;

	switch (access.mode) {
		case 'edit':
			return (
				<EditInspector doc={doc} node={node} edge={edge} error={error} {...access} />
			);
		case 'view':
			return <ViewInspector doc={doc} node={node} edge={edge} />;
		default: {
			const unreachable: never = access;
			return unreachable;
		}
	}
}

type Target = {
	doc: StrategyDoc;
	node: StrategyDoc['nodes'][string] | undefined;
	edge: StrategyDoc['edges'][string] | undefined;
};

function connectionName(doc: StrategyDoc, edge: NonNullable<Target['edge']>): string {
	return `${doc.nodes[edge.from]?.name || 'Untitled'} to ${doc.nodes[edge.to]?.name || 'Untitled'}`;
}

function ViewInspector({ doc, node, edge }: Target) {
	return (
		<aside className="inspector">
			{node && (
				<div className="form" key={node.id}>
					<h2>Node</h2>
					<p className="read-title">{node.name || 'Untitled'}</p>
					{node.notes !== '' && <p className="read-text">{node.notes}</p>}
					<MediaList media={node.media} access={{ mode: 'view' }} />
					{node.id === doc.rootNodeId && <p className="muted">This is the start of the strategy.</p>}
				</div>
			)}
			{edge && (
				<div className="form" key={edge.id}>
					<h2>Connection</h2>
					<p className="muted">{connectionName(doc, edge)}</p>
					{edge.label !== '' && <ReadField label="Reaction" value={edge.label} />}
					{edge.notes !== '' && <p className="read-text">{edge.notes}</p>}
					<MediaList media={edge.media} access={{ mode: 'view' }} />
				</div>
			)}
			{!node && !edge && (
				<div className="form">
					<h2>Strategy</h2>
					<ReadField label="Title" value={doc.title || 'Untitled'} />
					{doc.description !== '' && <ReadField label="Description" value={doc.description} />}
					<ReadField label="Ruleset" value={doc.ruleset} />
					<ReadField label="Starting side" value={doc.startingSide} />
				</div>
			)}
		</aside>
	);
}

type EditProps = Target & {
	error: string | null;
	exec: (cmd: Command) => ApplyResult;
	onDeleted: () => void;
	focusField: boolean;
};

function EditInspector({ doc, node, edge, error, exec, onDeleted, focusField }: EditProps) {
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
					<MediaList media={node.media} access={{ mode: 'edit', owner: { type: 'node', id: node.id }, exec }} />
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
					<p className="muted">{connectionName(doc, edge)}</p>
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
					<MediaList media={edge.media} access={{ mode: 'edit', owner: { type: 'edge', id: edge.id }, exec }} />
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
