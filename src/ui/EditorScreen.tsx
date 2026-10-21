import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow, type Connection } from '@xyflow/react';
import { exportStrategy } from '../exchange';
import { exportFileName } from '../model/exchange';
import type { ApplyResult, Command } from '../model/commands';
import { startLabel } from '../model/positions';
import {
	newEdgeId,
	newNodeId,
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
	reactionSpot,
	type Rect,
	type Point,
	type Selection,
	type StrategyFlowEdge,
	type StrategyFlowNode,
} from './flow';
import { BackLink } from './BackLink';
import { Inspector } from './Inspector';
import { OutlinePane } from './OutlinePane';
import { entrySelection, type OutlineEntry } from './outline';
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

function deletedName(doc: StrategyDoc, cmd: Command): string | null {
	if (cmd.type === 'deleteNode') return `“${doc.nodes[cmd.id]?.name || 'Untitled'}”`;
	if (cmd.type === 'deleteEdge') {
		const edge = doc.edges[cmd.id];
		return edge?.label ? `connection “${edge.label}”` : 'connection';
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
	const [focusField, setFocusField] = useState(false);
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
		}
	}

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), NOTICE_MS);
		return () => clearTimeout(timer);
	}, [notice]);

	useEffect(() => {
		if (!selection) return;
		const exists = selection.type === 'node' ? doc.nodes[selection.id] : doc.edges[selection.id];
		if (!exists) setSelection(null);
	}, [doc, selection]);

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
		setFocusField(false);
		setError(null);
	}

	function deleteSelection() {
		if (!selection) return;
		const cmd: Command =
			selection.type === 'node'
				? { type: 'deleteNode', id: selection.id }
				: { type: 'deleteEdge', id: selection.id };
		if (exec(cmd).ok) select(null);
	}

	const keys = useRef({ deleteSelection, step });
	keys.current = { deleteSelection, step };

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isEditable(e.target) || document.querySelector('dialog[open]')) return;
			const key = e.key.toLowerCase();
			if ((e.metaKey || e.ctrlKey) && !e.altKey && (key === 'z' || key === 'y')) {
				e.preventDefault();
				keys.current.step(key === 'y' || e.shiftKey ? 'redo' : 'undo');
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
			setSelection({ type: 'node', id: nodeId });
			setFocusField(true);
			revealAt(at);
		}
	}

	function addNode() {
		placeNode((id, at) => ({ type: 'addNode', id, name: 'New node', at }));
	}

	function addReaction() {
		const from = reactionSource(doc, selection);
		const flowNode = getNodes().find((n) => n.id === from);
		const origin = flowNode?.position ?? doc.layout[from] ?? { x: 0, y: 0 };
		const source: Rect = {
			...origin,
			width: flowNode?.measured?.width ?? NODE_SIZE.width,
			height: flowNode?.measured?.height ?? NODE_SIZE.height,
		};
		const childCount = Object.values(doc.edges).filter((edge) => edge.from === from).length;
		const at = reactionSpot(source, childCount, occupiedRects(getNodes(), getEdges()));
		const edge = newEdgeId();
		const result = exec({ type: 'addReaction', from, edge, node: newNodeId(), at });
		if (!result.ok) return;
		setSelection({ type: 'edge', id: edge });
		setFocusField(true);
		revealAt(at);
	}

	function selectEntry(entry: OutlineEntry) {
		select(entrySelection(entry));
		revealNode(entry.node);
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
		setSelection({ type: 'edge', id: edgeId });
		setFocusField(true);
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
				<OutlinePane doc={doc} selection={selection} onSelectEntry={selectEntry} />
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
						access={{ mode: 'edit', onMove, onMoveEnd: persist, onConnect }}
					/>
				</div>
				<Inspector
					doc={doc}
					selection={selection}
					error={error}
					access={{ mode: 'edit', exec, onDeleted: () => select(null), focusField, onAddReaction: addReaction }}
				/>
			</div>
		</div>
	);
}
