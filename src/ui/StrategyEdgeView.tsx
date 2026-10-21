import { createContext, useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { EdgeIdSchema, NodeIdSchema } from '../model/strategy';
import type { StrategyFlowEdge } from './flow';
import { InlineEditContext, InlineInput } from './InlineEdit';
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
	target,
	markerEnd,
	selected,
	data,
}: EdgeProps<StrategyFlowEdge>) {
	const selectEdge = useContext(SelectEdgeContext);
	const { start } = useContext(InlineEditContext);
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
	const editing = data?.editing ?? false;
	const position = { transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` };
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
			{editing && (
				<EdgeLabelRenderer>
					<div className="edge-pill editing nodrag nopan selected" style={position}>
						<InlineInput
							target={{ type: 'edge', id: EdgeIdSchema.parse(id) }}
							initial={label}
							className="edge-pill-input"
							label="Reaction"
							placeholder="Reaction"
							tabTo={NodeIdSchema.parse(target)}
						/>
						{hasMedia && <PlayIcon />}
					</div>
				</EdgeLabelRenderer>
			)}
			{!editing && (label !== '' || hasMedia) && (
				<EdgeLabelRenderer>
					<button
						type="button"
						tabIndex={-1}
						className={`edge-pill nodrag nopan${selected ? ' selected' : ''}`}
						style={position}
						title={label || undefined}
						onClick={() => selectEdge(id)}
						onDoubleClick={() => start({ type: 'edge', id: EdgeIdSchema.parse(id) })}
					>
						{label !== '' && <span className="edge-pill-text">{label}</span>}
						{hasMedia && <PlayIcon />}
					</button>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
