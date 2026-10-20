import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow, type Connection } from '@xyflow/react';
import { exportStrategy } from '../exchange';
import { exportFileName } from '../model/exchange';
import type { ApplyResult, Command } from '../model/commands';
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
	isInside,
	type Point,
	type Selection,
	type StrategyFlowNode,
} from './flow';
import { Inspector } from './Inspector';
import { PublishControl } from './PublishControl';
import { StrategyCanvas } from './StrategyCanvas';
import { useEditor } from './useEditor';

const SELECTED_NODE_GAP = 140;

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
					<a href="#/">Strategies</a>
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

function Editor({ initial }: { initial: StrategyDoc }) {
	const { doc, run, persist, saveError } = useEditor(initial);
	const { screenToFlowPosition, setCenter, getZoom, getNodes, getEdges } = useReactFlow<StrategyFlowNode>();
	const canvasRef = useRef<HTMLDivElement>(null);
	const [selection, setSelection] = useState<Selection>(null);
	const [error, setError] = useState<string | null>(null);
	const [focusField, setFocusField] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);

	function exec(cmd: Command, opts?: { persist?: boolean }): ApplyResult {
		const result = run(cmd, opts);
		setError(result.ok ? null : result.reason);
		return result;
	}

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

	const deleteRef = useRef(deleteSelection);
	deleteRef.current = deleteSelection;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			if (isEditable(e.target)) return;
			e.preventDefault();
			deleteRef.current();
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
			revealNode(at);
		}
	}

	function addNode() {
		placeNode((id, at) => ({ type: 'addNode', id, name: 'New node', at }));
	}

	function revealNode(at: Point) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
		const bottomRight = screenToFlowPosition({ x: rect.right, y: rect.bottom });
		const view = { ...topLeft, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
		if (isInside({ ...at, ...NODE_SIZE }, view)) return;
		setCenter(at.x + NODE_SIZE.width / 2, at.y + NODE_SIZE.height / 2, { zoom: getZoom(), duration: 200 });
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

	return (
		<div className="page editor-page">
			<header className="header">
				<a href="#/">Strategies</a>
				<h1>{doc.title || 'Untitled'}</h1>
				{doc.origin && (
					<span className="muted">
						Forked from <a href={publishedHref(doc.origin.publishedId)}>{doc.origin.title || 'Untitled'}</a> by <a href={profileHref(doc.origin.handle)}>@{doc.origin.handle}</a>
					</span>
				)}
				<button onClick={() => void onExport()} disabled={exporting}>
					{exporting ? 'Exporting…' : 'Export'}
				</button>
				{cloud && <PublishControl client={cloud} doc={doc} />}
				{saveError && <span className="error">{saveError}</span>}
				{exportError && <span className="error">{exportError}</span>}
			</header>
			<div className="editor">
				<div className="canvas" ref={canvasRef}>
					<div className="toolbar">
						<button onClick={addNode}>Add node</button>
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
					access={{ mode: 'edit', exec, onDeleted: () => select(null), focusField }}
				/>
			</div>
		</div>
	);
}
