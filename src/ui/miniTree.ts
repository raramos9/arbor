import type { StrategyDoc } from '../model/strategy';
import { groupSameReaction, type Outline, type OutlineEntry } from './outline';

export type TreeDotKind = 'start' | 'step' | 'end' | 'jump' | 'fork';
export type TreeDot = { x: number; y: number; kind: TreeDotKind };
export type TreeLink = { x1: number; y1: number; x2: number; y2: number; reaction: boolean };
export type MiniTree = { dots: TreeDot[]; links: TreeLink[]; columns: number; rows: number; clipped: boolean };

export const MINI_TREE_LIMITS = { depth: 7, rows: 7 };

// Columns are depth and rows are leaves, so the thumbnail reads left to right like the outline.
export function miniTree(outline: Outline, limits = MINI_TREE_LIMITS): MiniTree {
	const dots: TreeDot[] = [];
	const links: TreeLink[] = [];
	let rows = 0;
	let columns = 1;
	let clipped = false;

	function place(entry: OutlineEntry, depth: number): number {
		columns = Math.max(columns, depth + 1);
		const children = entry.kind === 'step' ? entry.next : [];
		if (children.length > 0 && depth + 1 >= limits.depth) clipped = true;
		const placed: { y: number; reaction: boolean; fork?: boolean }[] = [];
		if (depth + 1 < limits.depth) {
			for (const row of groupSameReaction(children)) {
				if (rows >= limits.rows) {
					clipped = true;
					break;
				}
				if (row.kind === 'entry') {
					placed.push({ y: place(row.entry, depth + 1), reaction: row.entry.reaction.trim() !== '' });
					continue;
				}
				// Outcomes of one reaction share a trunk to a fork halfway across, then branch.
				const ys: number[] = [];
				for (const entry of row.entries) {
					if (rows >= limits.rows) {
						clipped = true;
						break;
					}
					ys.push(place(entry, depth + 1));
				}
				const forkY = (ys[0]! + ys[ys.length - 1]!) / 2;
				for (const y of ys) links.push({ x1: depth + 0.5, y1: forkY, x2: depth + 1, y2: y, reaction: true });
				dots.push({ x: depth + 0.5, y: forkY, kind: 'fork' });
				placed.push({ y: forkY, reaction: true, fork: true });
			}
		}
		const y = placed.length > 0 ? (placed[0]!.y + placed[placed.length - 1]!.y) / 2 : rows++;
		for (const child of placed) {
			links.push({ x1: depth, y1: y, x2: child.fork ? depth + 0.5 : depth + 1, y2: child.y, reaction: child.reaction });
		}
		const kind: TreeDotKind =
			depth === 0 ? 'start' : entry.kind === 'jump' ? 'jump' : children.length === 0 ? 'end' : 'step';
		dots.push({ x: depth, y, kind });
		return y;
	}

	place(outline.start, 0);
	return { dots, links, columns, rows, clipped };
}

export type StrategyStats = { steps: number; reactions: number; ends: number };

export function strategyStats(doc: StrategyDoc): StrategyStats {
	const edges = Object.values(doc.edges);
	const leaving = new Set<string>(edges.map((edge) => edge.from));
	return {
		steps: Object.keys(doc.nodes).length,
		reactions: edges.filter((edge) => edge.label.trim() !== '').length,
		ends: Object.keys(doc.nodes).filter((id) => !leaving.has(id)).length,
	};
}

export function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60],
];

export function timeAgo(iso: string, now = Date.now()): string {
	const seconds = (new Date(iso).getTime() - now) / 1000;
	if (Number.isNaN(seconds)) return '';
	const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
	}
	return 'just now';
}
