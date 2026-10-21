import { useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import type { StrategyDoc } from '../model/strategy';
import { toFlowEdges, toFlowNodes, type Point, type Selection, type Size, type StrategyFlowNode } from './flow';
import { InlineEditContext, noInlineEdit, type EditTarget } from './InlineEdit';
import { SelectEdgeContext, StrategyEdgeView } from './StrategyEdgeView';
import { StrategyNodeView } from './StrategyNodeView';

const nodeTypes = { strategy: StrategyNodeView };
const edgeTypes = { strategy: StrategyEdgeView };

type CanvasAccess =
	| {
			mode: 'edit';
			onMove: (id: string, at: Point) => void;
			onMoveEnd: () => void;
			onConnect: (connection: Connection) => void;
			editing: Selection;
			onStartEdit: (target: EditTarget) => void;
			onCommitEdit: (target: EditTarget, text: string) => void;
			onCancelEdit: () => void;
	  }
	| { mode: 'view' };

type Props = {
	doc: StrategyDoc;
	selection: Selection;
	onSelect: (next: Selection) => void;
	access: CanvasAccess;
};

export function StrategyCanvas({ doc, selection, onSelect, access }: Props) {
	const [measured, setMeasured] = useState<Record<string, Size>>({});
	const editing = access.mode === 'edit' ? access.editing : null;
	const nodes = useMemo(() => toFlowNodes(doc, selection, editing, measured), [doc, selection, editing, measured]);
	const edges = useMemo(() => toFlowEdges(doc, selection, editing), [doc, selection, editing]);
	const editable = access.mode === 'edit';

	function selectNode(id: string) {
		const target = doc.nodes[id];
		if (target) onSelect({ type: 'node', id: target.id });
	}

	function selectEdge(id: string) {
		const target = doc.edges[id];
		if (target) onSelect({ type: 'edge', id: target.id });
	}

	function startNodeEdit(id: string) {
		const target = doc.nodes[id];
		if (target && access.mode === 'edit') access.onStartEdit({ type: 'node', id: target.id });
	}

	function startEdgeEdit(id: string) {
		const target = doc.edges[id];
		if (target && access.mode === 'edit') access.onStartEdit({ type: 'edge', id: target.id });
	}

	// Enter or Space on a focused node or edge reaches us as a select change, not a click.
	function onEdgesChange(changes: EdgeChange[]) {
		for (const change of changes) {
			if (change.type === 'select' && change.selected) selectEdge(change.id);
		}
	}

	function onNodesChange(changes: NodeChange<StrategyFlowNode>[]) {
		for (const change of changes) {
			if (change.type === 'select' && change.selected) selectNode(change.id);
			if (change.type === 'dimensions' && change.dimensions) {
				const size = change.dimensions;
				setMeasured((prev) => {
					const current = prev[change.id];
					if (current && current.width === size.width && current.height === size.height) return prev;
					return { ...prev, [change.id]: size };
				});
			}
			if (change.type === 'position' && access.mode === 'edit') {
				if (change.position) access.onMove(change.id, change.position);
				if (change.dragging === false) access.onMoveEnd();
			}
		}
	}

	const inlineEdit =
		access.mode === 'edit'
			? { start: access.onStartEdit, commit: access.onCommitEdit, cancel: access.onCancelEdit }
			: noInlineEdit;

	return (
		<SelectEdgeContext.Provider value={selectEdge}>
			<InlineEditContext.Provider value={inlineEdit}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={access.mode === 'edit' ? access.onConnect : undefined}
					onNodeClick={(_, node) => selectNode(node.id)}
					onNodeDragStart={editable ? (_, node) => selectNode(node.id) : undefined}
					onNodeDoubleClick={editable ? (_, node) => startNodeEdit(node.id) : undefined}
					onEdgeDoubleClick={editable ? (_, edge) => startEdgeEdit(edge.id) : undefined}
					onEdgeClick={(_, edge) => selectEdge(edge.id)}
					onPaneClick={() => onSelect(null)}
					nodesDraggable={editable}
					nodesConnectable={editable}
					edgesReconnectable={editable}
					zoomOnDoubleClick={false}
					deleteKeyCode={null}
					panActivationKeyCode={null}
					fitView
				>
					<Background />
					<Controls showInteractive={false} />
				</ReactFlow>
			</InlineEditContext.Provider>
		</SelectEdgeContext.Provider>
	);
}
