import { useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import type { StrategyDoc } from '../model/strategy';
import { toFlowEdges, toFlowNodes, type Point, type Selection, type Size, type StrategyFlowNode } from './flow';
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
	const nodes = useMemo(() => toFlowNodes(doc, selection, measured), [doc, selection, measured]);
	const edges = useMemo(() => toFlowEdges(doc, selection), [doc, selection]);
	const editing = access.mode === 'edit';

	function selectNode(id: string) {
		const target = doc.nodes[id];
		if (target) onSelect({ type: 'node', id: target.id });
	}

	function selectEdge(id: string) {
		const target = doc.edges[id];
		if (target) onSelect({ type: 'edge', id: target.id });
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

	return (
		<SelectEdgeContext.Provider value={selectEdge}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={access.mode === 'edit' ? access.onConnect : undefined}
				onNodeClick={(_, node) => selectNode(node.id)}
				onNodeDragStart={editing ? (_, node) => selectNode(node.id) : undefined}
				onEdgeClick={(_, edge) => selectEdge(edge.id)}
				onPaneClick={() => onSelect(null)}
				nodesDraggable={editing}
				nodesConnectable={editing}
				edgesReconnectable={editing}
				deleteKeyCode={null}
				panActivationKeyCode={null}
				fitView
			>
				<Background />
				<Controls showInteractive={false} />
			</ReactFlow>
		</SelectEdgeContext.Provider>
	);
}
