import { canonicalPosition, positionName, type Position } from '../model/positions';
import type { PublishedSummary } from '../model/publishing';
import type { Side } from '../model/strategy';

export type FeedGroup = { key: string; heading: string; items: PublishedSummary[] };

function positionKey(position: Position | null): string {
	if (!position) return 'none';
	return position.kind === 'listed' ? `listed:${position.id}` : `other:${position.name.trim().toLowerCase()}`;
}

function heading(position: Position | null, side: Side): string {
	if (!position) return `No starting position · ${side}`;
	if (position.kind === 'listed' && position.id === 'standing' && side === 'standing') return 'Standing';
	return `${positionName(position)} · ${side}`;
}

export function groupByStart(items: readonly PublishedSummary[]): FeedGroup[] {
	const groups = new Map<string, FeedGroup>();
	for (const item of items) {
		const position = item.doc.position && canonicalPosition(item.doc.position);
		const key = `${positionKey(position)}|${item.doc.startingSide}`;
		const group = groups.get(key);
		if (group) group.items.push(item);
		else groups.set(key, { key, heading: heading(position, item.doc.startingSide), items: [item] });
	}
	return [...groups.values()];
}
