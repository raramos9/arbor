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
import type { ApplyResult, Command } from '../model/commands';
import type { LibraryTechnique } from '../model/library';
import {
	newEdgeId,
	newNodeId,
	type NodeId,
	type NodeKind,
	type StrategyDoc,
	type StrategyNode,
} from '../model/strategy';
import { loadStrategy } from '../storage';
import { ConnectDialog } from './ConnectDialog';
import {
	NODE_SIZE,
	findFreeSpot,
	isInside,
	toFlowEdges,
	toFlowNodes,
	type Point,
	type Selection,
	type Size,
	type StrategyFlowNode,
} from './flow';
import { Inspector } from './Inspector';
import { LibraryDialog } from './LibraryDialog';
import { StrategyNodeView } from './StrategyNodeView';
import { useEditor } from './useEditor';

const nodeTypes = { strategy: StrategyNodeView };

const SELECTED_NODE_GAP = 140;

const KINDS: readonly NodeKind[] = ['position', 'technique', 'submission'];

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

type Pending = { from: StrategyNode; to: StrategyNode };

function Editor({ initial }: { initial: StrategyDoc }) {
	const { doc, run, persist, saveError } = useEditor(initial);
	const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
	const canvasRef = useRef<HTMLDivElement>(null);
	const [selection, setSelection] = useState<Selection>(null);
	const [error, setError] = useState<string | null>(null);
	const [focusName, setFocusName] = useState(false);
	const [pending, setPending] = useState<Pending | null>(null);
	const [pickingLibrary, setPickingLibrary] = useState(false);
	const [measured, setMeasured] = useState<Record<string, Size>>({});

	const nodes = useMemo(() => toFlowNodes(doc, selection, measured), [doc, selection, measured]);
	const edges = useMemo(() => toFlowEdges(doc, selection), [doc, selection]);

	function exec(cmd: Command, opts?: { persist?: boolean }): ApplyResult {
		const result = run(cmd, opts);
		setError(result.ok ? null : result.reason);
		return result;
	}

	function select(next: Selection) {
		setSelection(next);
		setFocusName(false);
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

	const pendingRef = useRef(pending);
	pendingRef.current = pending;

	const pickingLibraryRef = useRef(pickingLibrary);
	pickingLibraryRef.current = pickingLibrary;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (pendingRef.current || pickingLibraryRef.current) return;
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
		const at = findFreeSpot(
			candidate,
			nodes.map((n) => ({
				x: n.position.x,
				y: n.position.y,
				width: n.measured?.width ?? NODE_SIZE.width,
				height: n.measured?.height ?? NODE_SIZE.height,
			})),
		);
		const nodeId = newNodeId();
		const result = exec(create(nodeId, at));
		if (result.ok) {
			setSelection({ type: 'node', id: nodeId });
			setFocusName(true);
			revealNode(at);
		}
	}

	function addNode(kind: NodeKind) {
		placeNode((id, at) => ({ type: 'addNode', id, kind, name: `New ${kind}`, at }));
	}

	function addLibraryNode(technique: LibraryTechnique) {
		setPickingLibrary(false);
		placeNode((id, at) => ({ type: 'addLibraryNode', id, technique, at }));
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
		if (from && to) setPending({ from, to });
	}

	function createEdge(move: Extract<Command, { type: 'connect' }>['move']): string | null {
		if (!pending) return null;
		const edgeId = newEdgeId();
		const result = exec({ type: 'connect', id: edgeId, from: pending.from.id, to: pending.to.id, move });
		if (!result.ok) return result.reason;
		setPending(null);
		select({ type: 'edge', id: edgeId });
		return null;
	}

	return (
		<div className="page editor-page">
			<header className="header">
				<a href="#/">Strategies</a>
				<h1>{doc.title || 'Untitled'}</h1>
				{saveError && <span className="error">{saveError}</span>}
			</header>
			<div className="editor">
				<div className="canvas" ref={canvasRef}>
					<div className="toolbar">
						{KINDS.map((kind) => (
							<button key={kind} onClick={() => addNode(kind)}>
								Add {kind}
							</button>
						))}
						<button onClick={() => setPickingLibrary(true)}>From library</button>
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
					focusName={focusName}
					exec={exec}
					onDeleted={() => select(null)}
				/>
			</div>
			{pickingLibrary && (
				<LibraryDialog onPick={addLibraryNode} onCancel={() => setPickingLibrary(false)} />
			)}
			{pending && (
				<ConnectDialog
					from={pending.from}
					to={pending.to}
					onCreate={createEdge}
					onCancel={() => setPending(null)}
				/>
			)}
		</div>
	);
}
