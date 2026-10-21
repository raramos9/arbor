import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeIdSchema } from '../model/strategy';
import type { StrategyFlowNode } from './flow';
import { InlineInput } from './InlineEdit';
import { PlayIcon } from './PlayIcon';

export function StrategyNodeView({ id, data, selected }: NodeProps<StrategyFlowNode>) {
	return (
		<div className={`node${selected ? ' selected' : ''}${data.isRoot ? ' root' : ''}`}>
			<Handle type="target" position={Position.Top} />
			<div className="node-meta">
				{data.isRoot && <span className="root-badge">start</span>}
				{data.mediaCount > 0 && (
					<span className="media-badge" aria-hidden="true">
						<PlayIcon />
						{data.mediaCount}
					</span>
				)}
			</div>
			{data.editing ? (
				<InlineInput
					target={{ type: 'node', id: NodeIdSchema.parse(id) }}
					initial={data.name}
					className="node-name-input"
					label="Node name"
				/>
			) : (
				<div className="node-name">{data.name || 'Untitled'}</div>
			)}
			<Handle type="source" position={Position.Bottom} />
			{data.isEnd && <span className="line-end" aria-hidden="true" />}
		</div>
	);
}
