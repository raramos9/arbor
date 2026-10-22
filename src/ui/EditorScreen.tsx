import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow, type Connection } from '@xyflow/react';
import { exportStrategy } from '../exchange';
import { exportFileName } from '../model/exchange';
import type { ApplyResult, Command } from '../model/commands';
import { startLabel } from '../model/positions';
import {
	newEdgeId,
	newNodeId,
	reactionGroup,
	type EdgeId,
	type NodeId,
	type StrategyDoc,
} from '../model/strategy';
import { profileHref, publishedHref } from '../route';
import { cloud } from '../supabase';
import { loadStrategy } from '../storage';
import {
	NODE_SIZE,
	findFreeSpot,
	occupiedRects,
	reactionSource,
	settleSelection,
	optionSpot,
	reactionSpot,
	type Rect,
	type Point,
	type Selection,
	type StrategyFlowEdge,
	type StrategyFlowNode,
} from './flow';
import { BackLink } from './BackLink';
import type { EditTarget } from './InlineEdit';
import { Inspector } from './Inspector';
import { OutlinePane } from './OutlinePane';
import { entrySelection, reactionSelection, type OutlineEntry } from './outline';
import { PublishControl } from './PublishControl';
import { StrategyCanvas } from './StrategyCanvas';
import { useEditor } from './useEditor';
import { useRevealNode } from './useRevealNode';

const SELECTED_NODE_GAP = 140;
const NOTICE_MS = 8000;

function download(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url));
}

export function EditorScreen({ id }: { id: string }) {
	const [loaded] = useState(() => loadStrategy(id));
	if (!loaded.ok) {
		return (
			<div className="page">
				<header className="header">
					<BackLink />
				</header>
				<main className="notice">
					<h2>This strategy cannot be opened</h2>
					<p>{loaded.error}</p>
				</main>
			</div>
		);
	}
	return (
		<ReactFlowProvider>
			<Editor initial={loaded.value} />
		</ReactFlowProvider>
	);
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isActivatable(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return target.closest('button, a, summary') !== null && target.closest('.react-flow__node, .react-flow__edge') === null;
}

function deletedName(doc: StrategyDoc, cmd: Command): string | null {
	if (cmd.type === 'deleteNode') return `“${doc.nodes[cmd.id]?.name || 'Untitled'}”`;
	if (cmd.type === 'deleteEdge') {
		const edge = doc.edges[cmd.id];
		return edge?.label ? `connection “${edge.label}”` : 'connection';
	}
	if (cmd.type === 'deleteEdges') {
		const label = doc.edges[cmd.ids[0]!]?.label;
		return label ? `reaction “${label}”` : `${cmd.ids.length} connections`;
	}
	if (cmd.type === 'removeMedia') {
		const owner = cmd.owner.type === 'node' ? doc.nodes[cmd.owner.id] : doc.edges[cmd.owner.id];
		const title = owner?.media[cmd.index]?.title;
		return title ? `“${title}”` : 'clip';
	}
	return null;
}

function Editor({ initial }: { initial: StrategyDoc }) {
	const { doc, run, persist, saveError, undo, redo, canUndo, canRedo } = useEditor(initial);
	const { screenToFlowPosition, getNodes, getEdges } = useReactFlow<StrategyFlowNode, StrategyFlowEdge>();
	const canvasRef = useRef<HTMLDivElement>(null);
	const { revealAt, revealNode } = useRevealNode(canvasRef);
	const [selection, setSelection] = useState<Selection>(null);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<Selection>(null);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	function exec(cmd: Command, opts?: { persist?: boolean }): ApplyResult {
		const deleted = deletedName(doc, cmd);
		const result = run(cmd, opts);
		setError(result.ok ? null : result.reason);
		if (result.ok) setNotice(deleted && `Deleted ${deleted}`);
		return result;
	}

	function step(direction: 'undo' | 'redo') {
		if ((direction === 'undo' ? undo : redo)()) {
			setNotice(null);
			setError(null);
			setEditing(null);
		}
	}

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), NOTICE_MS);
		return () => clearTimeout(timer);
	}, [notice]);

	const settledDoc = useRef(doc);
	useEffect(() => {
		const settled = settleSelection(doc, selection, settledDoc.current);
		settledDoc.current = doc;
		if (settled !== selection) setSelection(settled);
	}, [doc, selection]);

	useEffect(() => {
		if (!editing) return;
		const exists = editing.type === 'node' ? doc.nodes[editing.id] : doc.edges[editing.id];
		if (!exists) setEditing(null);
	}, [doc, editing]);

	async function onExport() {
		setExporting(true);
		setExportError(null);
		const exported = await exportStrategy(doc);
		setExporting(false);
		if (!exported.ok) {
			setExportError(exported.error);
			return;
		}
		download(exported.value, exportFileName(doc));
	}

	function select(next: Selection) {
		setSelection(next);
		setError(null);
	}

	function deleteSelection() {
		if (!selection) return;
		let cmd: Command;
		if (selection.type === 'node') cmd = { type: 'deleteNode', id: selection.id };
		else if (selection.type === 'reaction') cmd = { type: 'deleteEdges', ids: reactionGroup(doc, selection.id) };
		else cmd = { type: 'deleteEdge', id: selection.id };
		if (exec(cmd).ok) select(null);
	}

	function startEdit(target: EditTarget) {
		// Renaming the leader of a selected reaction keeps the whole reaction selected.
		const keepsReaction = selection?.type === 'reaction' && target.type === 'edge' && target.id === selection.id;
		if (!keepsReaction) setSelection(target);
		setEditing(target);
	}

	function commitEdit(target: EditTarget, text: string) {
		if (target.type === 'node') {
			const node = doc.nodes[target.id];
			if (node && node.name !== text) exec({ type: 'updateNode', id: target.id, patch: { name: text } });
		} else {
			const edge = doc.edges[target.id];
			if (edge && edge.label !== text.trim()) exec({ type: 'relabelEdges', ids: reactionGroup(doc, target.id), label: text });
		}
		setEditing(null);
	}

	function startEditingSelection(): boolean {
		if (!selection) return false;
		startEdit(selection.type === 'reaction' ? { type: 'edge', id: selection.id } : selection);
		return true;
	}

	const keys = useRef({ deleteSelection, step, startEditingSelection });
	keys.current = { deleteSelection, step, startEditingSelection };

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isEditable(e.target) || document.querySelector('dialog[open]')) return;
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 'z' || key === 'y')) {
				e.preventDefault();
				keys.current.step(key === 'y' || e.shiftKey ? 'redo' : 'undo');
				return;
			}
			if (e.key === 'F2' || (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !isActivatable(e.target))) {
				if (keys.current.startEditingSelection()) e.preventDefault();
				return;
			}
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			e.preventDefault();
			keys.current.deleteSelection();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	function placeNode(create: (id: NodeId, at: Point) => Command) {
		const nodes = getNodes();
		const selected = selection?.type === 'node' ? nodes.find((n) => n.id === selection.id) : undefined;
		let candidate: Point;
		if (selected) {
			candidate = { x: selected.position.x, y: selected.position.y + SELECTED_NODE_GAP };
		} else {
			const rect = canvasRef.current?.getBoundingClientRect();
			const center = rect
				? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
				: { x: 0, y: 0 };
			candidate = { x: center.x - NODE_SIZE.width / 2, y: center.y - NODE_SIZE.height / 2 };
		}
		const at = findFreeSpot(candidate, occupiedRects(nodes, getEdges()));
		const nodeId = newNodeId();
		const result = exec(create(nodeId, at));
		if (result.ok) {
			startEdit({ type: 'node', id: nodeId });
			revealAt(at);
		}
	}

	function addNode() {
		placeNode((id, at) => ({ type: 'addNode', id, name: 'New node', at }));
	}

	function addReaction() {
		const from = reactionSource(doc, selection);
		const source = rectOf(from);
		const childCount = Object.values(doc.edges).filter((edge) => edge.from === from).length;
		const at = reactionSpot(source, childCount, occupiedRects(getNodes(), getEdges()));
		const created = branchFrom(from, '', at);
		if (created) startEdit({ type: 'edge', id: created.edge });
	}

	// Another outcome for the same reaction: a sibling connection from the same node, carrying the same words,
	// placed in the row of the outcomes it joins.
	function addOption(edgeId: EdgeId) {
		const edge = doc.edges[edgeId];
		if (!edge) return;
		const outcomes = reactionGroup(doc, edgeId).flatMap((id) => {
			const target = doc.edges[id]?.to;
			return target ? [rectOf(target)] : [];
		});
		const at = optionSpot(outcomes, occupiedRects(getNodes(), getEdges()));
		const created = branchFrom(edge.from, edge.label, at);
		if (created) startEdit({ type: 'node', id: created.node });
	}

	function rectOf(id: NodeId): Rect {
		const flowNode = getNodes().find((n) => n.id === id);
		const origin = flowNode?.position ?? doc.layout[id] ?? { x: 0, y: 0 };
		return {
			...origin,
			width: flowNode?.measured?.width ?? NODE_SIZE.width,
			height: flowNode?.measured?.height ?? NODE_SIZE.height,
		};
	}

	function branchFrom(from: NodeId, label: string, at: Point): { edge: EdgeId; node: NodeId } | null {
		const edge = newEdgeId();
		const node = newNodeId();
		const result = exec({ type: 'addReaction', from, edge, node, at, label });
		if (!result.ok) return null;
		revealAt(at);
		return { edge, node };
	}

	function selectEntry(entry: OutlineEntry) {
		select(entrySelection(entry));
		revealNode(entry.node);
	}

	function selectReaction(leader: OutlineEntry) {
		select(reactionSelection(leader));
		revealNode(leader.node);
	}

	function onMove(id: string, at: Point) {
		const node = doc.nodes[id];
		if (node) run({ type: 'moveNode', id: node.id, at }, { persist: false });
	}

	function onConnect(connection: Connection) {
		const from = doc.nodes[connection.source];
		const to = doc.nodes[connection.target];
		if (!from || !to) return;
		const edgeId = newEdgeId();
		const result = exec({ type: 'connect', id: edgeId, from: from.id, to: to.id, label: '' });
		if (!result.ok) return;
		startEdit({ type: 'edge', id: edgeId });
	}

	const isBlank = Object.keys(doc.nodes).length === 1 && Object.keys(doc.edges).length === 0;

	return (
		<div className="page editor-page">
			<header className="header">
				<BackLink />
				<span className="header-sep" />
				<h1>{doc.title || 'Untitled'}</h1>
				{doc.position ? (
					<span className="position-chip">
						{startLabel(doc.position, doc.startingSide)}
					</span>
				) : (
					<button className="position-chip" onClick={() => select(null)}>
						Set starting position
					</button>
				)}
				{doc.origin && (
					<span className="muted">
						Forked from <a href={publishedHref(doc.origin.publishedId)}>{doc.origin.title || 'Untitled'}</a> by <a href={profileHref(doc.origin.handle)}>@{doc.origin.handle}</a>
					</span>
				)}
				{saveError && <span className="error">{saveError}</span>}
				{exportError && <span className="error">{exportError}</span>}
				<div className="header-actions">
					<button onClick={() => step('undo')} disabled={!canUndo} aria-keyshortcuts="Meta+Z Control+Z">
						Undo
					</button>
					<button
						onClick={() => step('redo')}
						disabled={!canRedo}
						aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y"
					>
						Redo
					</button>
					<button onClick={() => void onExport()} disabled={exporting}>
						{exporting ? 'Exporting…' : 'Export'}
					</button>
					{cloud && <PublishControl client={cloud} doc={doc} />}
				</div>
			</header>
			<div className="editor">
				<OutlinePane doc={doc} selection={selection} onSelectEntry={selectEntry} onSelectReaction={selectReaction} />
				<div className="canvas" ref={canvasRef}>
					<div className="toolbar">
						<button
							className="primary"
							onClick={addReaction}
							aria-label={`Add a reaction after ${doc.nodes[reactionSource(doc, selection)]?.name || 'Untitled'}`}
						>
							+ Reaction
						</button>
						<button onClick={addNode}>Add node</button>
					</div>
					{isBlank && (
						<div className="canvas-hint">
							<span>What does he do first?</span>
							<button onClick={addReaction}>+ Reaction</button>
						</div>
					)}
					<div className="notice-bar" role="status">
						{notice && (
							<>
								<span>{notice}</span>
								<button onClick={() => step('undo')}>Undo</button>
							</>
						)}
					</div>
					<StrategyCanvas
						doc={doc}
						selection={selection}
						onSelect={select}
						access={{
							mode: 'edit',
							onMove,
							onMoveEnd: persist,
							onConnect,
							editing,
							onStartEdit: startEdit,
							onCommitEdit: commitEdit,
							onCancelEdit: () => setEditing(null),
						}}
					/>
				</div>
				<Inspector
					doc={doc}
					selection={selection}
					error={error}
					onSelect={select}
					access={{ mode: 'edit', exec, onDeleted: () => select(null), onAddReaction: addReaction, onAddOption: addOption }}
				/>
			</div>
		</div>
	);
}
