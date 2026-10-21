import { useRef, useState } from 'react';
import type { ApplyResult, Command } from '../model/commands';
import { positionName } from '../model/positions';
import { reactionGroup, RulesetSchema, SideSchema, type EdgeId, type StrategyDoc } from '../model/strategy';
import { Field, ReadField, SelectField } from './Field';
import type { Selection } from './flow';
import { MediaList } from './MediaList';
import { PositionField } from './PositionField';

type InspectorAccess =
	| {
			mode: 'edit';
			exec: (cmd: Command) => ApplyResult;
			onDeleted: () => void;
			onAddReaction: () => void;
			onAddOption: (edge: EdgeId) => void;
	  }
	| { mode: 'view' };

type Props = {
	doc: StrategyDoc;
	selection: Selection;
	error: string | null;
	onSelect: (next: Selection) => void;
	access: InspectorAccess;
};

export function Inspector({ doc, selection, error, onSelect, access }: Props) {
	const node = selection?.type === 'node' ? doc.nodes[selection.id] : undefined;
	const edge = selection?.type === 'edge' ? doc.edges[selection.id] : undefined;
	const reaction = selection?.type === 'reaction' && doc.edges[selection.id] ? selection.id : undefined;

	switch (access.mode) {
		case 'edit':
			return (
				<EditInspector doc={doc} node={node} edge={edge} reaction={reaction} error={error} onSelect={onSelect} {...access} />
			);
		case 'view':
			return <ViewInspector doc={doc} node={node} edge={edge} reaction={reaction} onSelect={onSelect} />;
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
	reaction: EdgeId | undefined;
	onSelect: (next: Selection) => void;
};

// Every outcome of the reaction, each a way to select that one connection.
function OutcomeList({ doc, group, onSelect }: { doc: StrategyDoc; group: EdgeId[]; onSelect: (next: Selection) => void }) {
	return (
		<div className="outcomes">
			<p className="muted">Outcomes</p>
			<ul>
				{group.filter((id) => doc.edges[id]).map((id) => (
					<li key={id}>
						<button onClick={() => onSelect({ type: 'edge', id })}>{doc.nodes[doc.edges[id]!.to]?.name || 'Untitled'}</button>
					</li>
				))}
			</ul>
		</div>
	);
}

function connectionName(doc: StrategyDoc, edge: NonNullable<Target['edge']>): string {
	return `${doc.nodes[edge.from]?.name || 'Untitled'} to ${doc.nodes[edge.to]?.name || 'Untitled'}`;
}

function ViewInspector({ doc, node, edge, reaction, onSelect }: Target) {
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
			{reaction && (
				<div className="form" key={`reaction:${reaction}`}>
					<h2>Reaction</h2>
					<ReadField label="Reaction" value={doc.edges[reaction]?.label ?? ''} />
					<OutcomeList doc={doc} group={reactionGroup(doc, reaction)} onSelect={onSelect} />
				</div>
			)}
			{!node && !edge && !reaction && (
				<div className="form">
					<h2>Strategy</h2>
					<ReadField label="Title" value={doc.title || 'Untitled'} />
					{doc.description !== '' && <ReadField label="Description" value={doc.description} />}
					{doc.position && <ReadField label="Starting position" value={positionName(doc.position)} />}
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
	onAddReaction: () => void;
	onAddOption: (edge: EdgeId) => void;
};

function EditInspector({ doc, node, edge, reaction, onSelect, error, exec, onDeleted, onAddReaction, onAddOption }: EditProps) {
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
						onChange={(name) => exec({ type: 'updateNode', id: node.id, patch: { name } })}
					/>
					<Field
						label="Notes"
						multiline
						value={node.notes}
						onChange={(notes) => exec({ type: 'updateNode', id: node.id, patch: { notes } })}
					/>
					<MediaList media={node.media} access={{ mode: 'edit', owner: { type: 'node', id: node.id }, exec }} />
					<button onClick={onAddReaction}>+ Reaction</button>
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
					<ReactionField key={edge.id} doc={doc} edge={edge.id} exec={exec} />
					<Field
						label="Then"
						placeholder="Your next move"
						value={doc.nodes[edge.to]?.name ?? ''}
						onChange={(name) => exec({ type: 'updateNode', id: edge.to, patch: { name } })}
					/>
					<Field
						label="Notes"
						multiline
						value={edge.notes}
						onChange={(notes) => exec({ type: 'updateEdge', id: edge.id, patch: { notes } })}
					/>
					<MediaList media={edge.media} access={{ mode: 'edit', owner: { type: 'edge', id: edge.id }, exec }} />
					{edge.label !== '' && (
						<button onClick={() => onAddOption(edge.id)}>+ Option for “{edge.label}”</button>
					)}
					<button className="danger" onClick={() => remove({ type: 'deleteEdge', id: edge.id })}>
						Delete connection
					</button>
				</div>
			)}
			{reaction && (
				<ReactionPanel
					key={`reaction:${reaction}`}
					doc={doc}
					leader={reaction}
					exec={exec}
					onSelect={onSelect}
					onAddOption={onAddOption}
					onDelete={(ids) => remove({ type: 'deleteEdges', ids })}
				/>
			)}
			{!node && !edge && !reaction && (
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
					<PositionField
						value={doc.position}
						allowNone
						onChange={(position) => exec({ type: 'updateMeta', patch: { position } })}
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

type ReactionPanelProps = {
	doc: StrategyDoc;
	leader: EdgeId;
	exec: (cmd: Command) => ApplyResult;
	onSelect: (next: Selection) => void;
	onAddOption: (edge: EdgeId) => void;
	onDelete: (ids: EdgeId[]) => void;
};

function ReactionPanel({ doc, leader, exec, onSelect, onAddOption, onDelete }: ReactionPanelProps) {
	const label = doc.edges[leader]?.label ?? '';
	// While the words are cleared the reaction matches nothing, so keep the outcomes it had last.
	const last = useRef(reactionGroup(doc, leader));
	if (label.trim() !== '') last.current = reactionGroup(doc, leader);
	const group = last.current;
	return (
		<div className="form">
			<h2>Reaction</h2>
			<ReactionField doc={doc} edge={leader} group={group} exec={exec} />
			<OutcomeList doc={doc} group={group} onSelect={onSelect} />
			{label !== '' && <button onClick={() => onAddOption(leader)}>+ Option for “{label}”</button>}
			<button className="danger" onClick={() => onDelete(group.filter((id) => doc.edges[id]))}>
				Delete reaction
			</button>
		</div>
	);
}

// The outcomes sharing this reaction are fixed when the connection is selected, so clearing the words while
// typing doesn't drop the others from the group or pull in unrelated "then" connections.
function ReactionField({ doc, edge, group: frozen, exec }: { doc: StrategyDoc; edge: EdgeId; group?: EdgeId[]; exec: (cmd: Command) => ApplyResult }) {
	const [own] = useState(() => reactionGroup(doc, edge));
	const group = frozen ?? own;
	return (
		<>
			<Field
				label="Reaction"
				placeholder="How your opponent reacts"
				value={doc.edges[edge]?.label ?? ''}
				onChange={(label) => exec({ type: 'relabelEdges', ids: group.filter((id) => doc.edges[id]), label })}
			/>
			{group.length > 1 && <p className="muted field-note">Shared by {group.length} options. Renaming it renames them all.</p>}
		</>
	);
}
