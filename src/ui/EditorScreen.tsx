import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Background,
	Controls,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	type Connection,
	type NodeChange,
} from '@xyflow/react';
import { exportStrategy } from '../exchange';
import { exportFileName } from '../model/exchange';
import type { ApplyResult, Command } from '../model/commands';
import {
	newEdgeId,
	newNodeId,
	type NodeId,
	type StrategyDoc,
} from '../model/strategy';
import { loadStrategy } from '../storage';
import {
	NODE_SIZE,
	findFreeSpot,
	occupiedRects,
	isInside,
	toFlowEdges,
	toFlowNodes,
	type Point,
	type Selection,
	type Size,
	type StrategyFlowNode,
} from './flow';
import { Inspector } from './Inspector';
import { StrategyNodeView } from './StrategyNodeView';
import { useEditor } from './useEditor';

const nodeTypes = { strategy: StrategyNodeView };

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
	const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
	const canvasRef = useRef<HTMLDivElement>(null);
	const [selection, setSelection] = useState<Selection>(null);
	const [error, setError] = useState<string | null>(null);
	const [focusField, setFocusField] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);
	const [measured, setMeasured] = useState<Record<string, Size>>({});

	const nodes = useMemo(() => toFlowNodes(doc, selection, measured), [doc, selection, measured]);
	const edges = useMemo(() => toFlowEdges(doc, selection), [doc, selection]);

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
		const at = findFreeSpot(candidate, occupiedRects(nodes, edges));
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

	function onNodesChange(changes: NodeChange<StrategyFlowNode>[]) {
		for (const change of changes) {
			if (change.type === 'dimensions' && change.dimensions) {
				const size = change.dimensions;
				setMeasured((prev) => {
					const current = prev[change.id];
					if (current && current.width === size.width && current.height === size.height) return prev;
					return { ...prev, [change.id]: size };
				});
			}
			if (change.type === 'position') {
				const node = doc.nodes[change.id];
				if (node && change.position) {
					run({ type: 'moveNode', id: node.id, at: change.position }, { persist: false });
				}
				if (change.dragging === false) persist();
			}
		}
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
				<button onClick={() => void onExport()} disabled={exporting}>
					{exporting ? 'Exporting…' : 'Export'}
				</button>
				{saveError && <span className="error">{saveError}</span>}
				{exportError && <span className="error">{exportError}</span>}
			</header>
			<div className="editor">
				<div className="canvas" ref={canvasRef}>
					<div className="toolbar">
						<button onClick={addNode}>Add node</button>
					</div>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						nodeTypes={nodeTypes}
						onNodesChange={onNodesChange}
						onConnect={onConnect}
						onNodeClick={(_, node) => {
							const target = doc.nodes[node.id];
							if (target) select({ type: 'node', id: target.id });
						}}
						onNodeDragStart={(_, node) => {
							const target = doc.nodes[node.id];
							if (target) select({ type: 'node', id: target.id });
						}}
						onEdgeClick={(_, edge) => {
							const target = doc.edges[edge.id];
							if (target) select({ type: 'edge', id: target.id });
						}}
						onPaneClick={() => select(null)}
						deleteKeyCode={null}
						fitView
					>
						<Background />
						<Controls showInteractive={false} />
					</ReactFlow>
				</div>
				<Inspector
					doc={doc}
					selection={selection}
					error={error}
					focusField={focusField}
					exec={exec}
					onDeleted={() => select(null)}
				/>
			</div>
		</div>
	);
}
