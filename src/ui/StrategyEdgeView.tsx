import { createContext, useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { StrategyFlowEdge } from './flow';
import { PlayIcon } from './PlayIcon';

export const SelectEdgeContext = createContext<(id: string) => void>(() => {});

const EDGE_COLOR = '#a1a1aa';
const EDGE_COLOR_SELECTED = '#4f46e5';

export function StrategyEdgeView({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	markerEnd,
	selected,
	data,
}: EdgeProps<StrategyFlowEdge>) {
	const selectEdge = useContext(SelectEdgeContext);
	const [path, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});
	const label = data?.label ?? '';
	const hasMedia = (data?.mediaCount ?? 0) > 0;
	return (
		<>
			<BaseEdge
				id={id}
				path={path}
				markerEnd={markerEnd}
				style={{
					stroke: selected ? EDGE_COLOR_SELECTED : EDGE_COLOR,
					...(label === '' ? { strokeDasharray: '5 4' } : {}),
				}}
			/>
			{(label !== '' || hasMedia) && (
				<EdgeLabelRenderer>
					<button
						type="button"
						tabIndex={-1}
						className={`edge-pill nodrag nopan${selected ? ' selected' : ''}`}
						style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
						title={label || undefined}
						onClick={() => selectEdge(id)}
					>
						{label !== '' && <span className="edge-pill-text">{label}</span>}
						{hasMedia && <PlayIcon />}
					</button>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
