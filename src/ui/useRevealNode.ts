import { useCallback, type RefObject } from 'react';
import { useReactFlow } from '@xyflow/react';
import { NODE_SIZE, isInside, type Point, type Size, type StrategyFlowEdge, type StrategyFlowNode } from './flow';

const PAN_MS = 200;

export function useRevealNode(canvasRef: RefObject<HTMLElement>) {
	const { screenToFlowPosition, setCenter, getZoom, getNode } = useReactFlow<StrategyFlowNode, StrategyFlowEdge>();

	const revealAt = useCallback(
		(at: Point, size = NODE_SIZE) => {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;
			const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
			const bottomRight = screenToFlowPosition({ x: rect.right, y: rect.bottom });
			const view = { ...topLeft, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
			if (isInside({ ...at, ...size }, view)) return;
			setCenter(at.x + size.width / 2, at.y + size.height / 2, { zoom: getZoom(), duration: PAN_MS });
		},
		[canvasRef, screenToFlowPosition, setCenter, getZoom],
	);

	const revealNode = useCallback(
		(id: string) => {
			const node = getNode(id);
			if (node) revealAt(node.position, node.measured?.width && node.measured.height ? (node.measured as Size) : NODE_SIZE);
		},
		[getNode, revealAt],
	);

	return { revealAt, revealNode };
}
