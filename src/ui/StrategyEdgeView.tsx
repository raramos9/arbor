import { createContext, useCallback, useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react';
import { EdgeIdSchema, NodeIdSchema } from '../model/strategy';
import { forkPoint, type EdgeFork, type StrategyFlowEdge } from './flow';
import { InlineEditContext, InlineInput } from './InlineEdit';
import { PlayIcon } from './PlayIcon';

// The pill stands for the whole reaction, so it selects every outcome rather than one.
export const SelectReactionContext = createContext<(id: string) => void>(() => {});

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
	const selectReaction = useContext(SelectReactionContext);
	const { start } = useContext(InlineEditContext);
	const fork = data?.fork ?? null;
	const forkAt = useStore(useCallback((state: ReactFlowState) => forkKey(state, fork), [fork]));
	let path: string;
	let labelX: number;
	let labelY: number;
	if (forkAt === null) {
		[path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
	} else {
		const [x, y] = forkAt.split(',').map(Number) as [number, number];
		const point = forkPoint({ x: sourceX, y: sourceY }, [{ x, y }]);
		const [trunk] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX: point.x, targetY: point.y, targetPosition: Position.Top });
		const [branch, branchX, branchY] = getBezierPath({
			sourceX: point.x,
			sourceY: point.y,
			sourcePosition: Position.Bottom,
			targetX,
			targetY,
			targetPosition,
		});
		path = `${trunk} ${branch}`;
		[labelX, labelY] = fork?.leader ? [point.x, point.y] : [branchX, branchY];
	}
	// Only the first outcome of a shared reaction draws its words; the others draw just their branch.
	const words = data?.label ?? '';
	const label = fork && !fork.leader ? '' : words;
	const hasMedia = (data?.mediaCount ?? 0) > 0;
	const pillSelected = fork ? fork.selected : selected;
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
					...(words === '' ? { strokeDasharray: '5 4' } : {}),
				}}
			/>
			{editing && (
				<EdgeLabelRenderer>
					<div className="edge-pill editing nodrag nopan selected" style={position}>
						<InlineInput
							target={{ type: 'edge', id: EdgeIdSchema.parse(id) }}
							initial={words}
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
						className={`edge-pill nodrag nopan${pillSelected ? ' selected' : ''}`}
						style={position}
						title={label || undefined}
						aria-label={fork ? `Reaction: ${label}, ${fork.targets.length} outcomes` : undefined}
						onClick={(e) => {
							// The pill is portaled but still bubbles to React Flow's edge click, which would select this one outcome.
							e.stopPropagation();
							selectReaction(id);
						}}
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

// The average of the targets' top handles, as a string so the store only re-renders this edge when it moves.
function forkKey(state: ReactFlowState, fork: EdgeFork | null): string | null {
	if (!fork) return null;
	let x = 0;
	let y = 0;
	let count = 0;
	for (const id of fork.targets) {
		const node = state.nodeLookup.get(id);
		if (!node) continue;
		x += node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2;
		y += node.internals.positionAbsolute.y;
		count += 1;
	}
	return count === 0 ? null : `${x / count},${y / count}`;
}
