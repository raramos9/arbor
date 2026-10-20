import { useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, type Connection, type NodeChange } from '@xyflow/react';
import type { StrategyDoc } from '../model/strategy';
import { toFlowEdges, toFlowNodes, type Point, type Selection, type Size, type StrategyFlowNode } from './flow';
import { StrategyNodeView } from './StrategyNodeView';

const nodeTypes = { strategy: StrategyNodeView };

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
			if (change.type === 'position' && access.mode === 'edit') {
				if (change.position) access.onMove(change.id, change.position);
				if (change.dragging === false) access.onMoveEnd();
			}
		}
	}

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodesChange={onNodesChange}
			onConnect={access.mode === 'edit' ? access.onConnect : undefined}
			onNodeClick={(_, node) => selectNode(node.id)}
			onNodeDragStart={editing ? (_, node) => selectNode(node.id) : undefined}
			onEdgeClick={(_, edge) => {
				const target = doc.edges[edge.id];
				if (target) onSelect({ type: 'edge', id: target.id });
			}}
			onPaneClick={() => onSelect(null)}
			nodesDraggable={editing}
			nodesConnectable={editing}
			edgesReconnectable={editing}
			deleteKeyCode={null}
			fitView
		>
			<Background />
			<Controls showInteractive={false} />
		</ReactFlow>
	);
}
