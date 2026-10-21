import { canonicalPosition, startLabel, type Position } from '../model/positions';
import type { PublishedSummary } from '../model/publishing';

export type FeedGroup = { key: string; heading: string; items: PublishedSummary[] };

const UNSET_KEY = 'none';

function positionKey(position: Position | null): string {
	if (!position) return UNSET_KEY;
	return position.kind === 'listed' ? `listed:${position.id}` : `other:${position.name.trim().toLowerCase()}`;
}

// An unset position on the standing side is the same start as Standing, so it joins that group.
const STANDING: Position = { kind: 'listed', id: 'standing' };

export function groupByStart(items: readonly PublishedSummary[]): FeedGroup[] {
	const groups = new Map<string, FeedGroup>();
	for (const item of items) {
		const side = item.doc.startingSide;
		const canonical = item.doc.position && canonicalPosition(item.doc.position);
		const position = canonical ?? (side === 'standing' ? STANDING : null);
		const key = position ? `${positionKey(position)}|${side}` : UNSET_KEY;
		const group = groups.get(key);
		if (group) group.items.push(item);
		else groups.set(key, { key, heading: position ? startLabel(position, side) : 'Position not set', items: [item] });
	}
	const all = [...groups.values()];
	return [...all.filter((g) => g.key !== UNSET_KEY), ...all.filter((g) => g.key === UNSET_KEY)];
}
