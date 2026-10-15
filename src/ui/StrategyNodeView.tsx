import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StrategyFlowNode } from './flow';

export function StrategyNodeView({ data, selected }: NodeProps<StrategyFlowNode>) {
	return (
		<div className={`node node-${data.kind}${selected ? ' selected' : ''}${data.isRoot ? ' root' : ''}`}>
			<Handle type="target" position={Position.Top} />
			<div className="node-meta">
				<span>{data.kind}</span>
				{data.isRoot && <span className="root-badge">start</span>}
				{data.mediaCount > 0 && <span className="media-badge">▶ {data.mediaCount}</span>}
			</div>
			<div className="node-name">{data.name || 'Untitled'}</div>
			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
