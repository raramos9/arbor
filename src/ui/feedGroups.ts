import { positionName } from '../model/positions';
import type { PublishedSummary } from '../model/publishing';

export type FeedGroup = { key: string; heading: string; items: PublishedSummary[] };

function positionKey(item: PublishedSummary): string {
	const { position } = item.doc;
	if (!position) return 'none';
	return position.kind === 'listed' ? `listed:${position.id}` : `other:${position.name.trim().toLowerCase()}`;
}

function heading(item: PublishedSummary): string {
	const { position, startingSide } = item.doc;
	if (!position) return `No starting position · ${startingSide}`;
	if (position.kind === 'listed' && position.id === 'standing' && startingSide === 'standing') return 'Standing';
	return `${positionName(position)} · ${startingSide}`;
}

export function groupByStart(items: readonly PublishedSummary[]): FeedGroup[] {
	const groups = new Map<string, FeedGroup>();
	for (const item of items) {
		const key = `${positionKey(item)}|${item.doc.startingSide}`;
		const group = groups.get(key);
		if (group) group.items.push(item);
		else groups.set(key, { key, heading: heading(item), items: [item] });
	}
	return [...groups.values()];
}
