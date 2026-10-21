import type { MiniTree, TreeDotKind } from './miniTree';

const COLUMN = 40;
const ROW = 18;
const PAD = 16;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 88;

const RADIUS: Record<TreeDotKind, number> = { start: 5, step: 4, end: 3.5, jump: 3.5, fork: 2.5 };

// A small canvas: the strategy's lines drawn with the editor's marks (solid reaction, dashed "then", zinc line end).
export function MiniTreeView({ tree }: { tree: MiniTree }) {
	const contentWidth = (tree.columns - 1) * COLUMN;
	const contentHeight = (tree.rows - 1) * ROW;
	const width = Math.max(contentWidth + PAD * 2, MIN_WIDTH);
	const height = Math.max(contentHeight + PAD * 2, MIN_HEIGHT);
	const px = (x: number) => (width - contentWidth) / 2 + x * COLUMN;
	const py = (y: number) => (height - contentHeight) / 2 + y * ROW;

	return (
		<div className={tree.clipped ? 'thumb clipped' : 'thumb'}>
			<svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
				{tree.links.map((link, index) => {
					const x1 = px(link.x1);
					const x2 = px(link.x2);
					const mid = (x1 + x2) / 2;
					return (
						<path
							key={index}
							className={link.reaction ? 'mt-link' : 'mt-link then'}
							d={`M${x1} ${py(link.y1)}C${mid} ${py(link.y1)} ${mid} ${py(link.y2)} ${x2} ${py(link.y2)}`}
						/>
					);
				})}
				{tree.dots.map((dot, index) => (
					<circle key={index} className={`mt-${dot.kind}`} cx={px(dot.x)} cy={py(dot.y)} r={RADIUS[dot.kind]} />
				))}
			</svg>
			{tree.clipped && tree.hidden > 0 && <span className="thumb-more">+{tree.hidden}</span>}
		</div>
	);
}
