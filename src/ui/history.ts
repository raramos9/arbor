import type { Command } from '../model/commands';
import type { StrategyDoc } from '../model/strategy';

const LIMIT = 100;
// Dragging a node or typing into a field sends a command per frame or keystroke.
// Repeats of the same edit within this window collapse into one undo step.
const MERGE_MS = 1000;

function editKey(cmd: Command): string | null {
	switch (cmd.type) {
		case 'moveNode':
			return `move:${cmd.id}`;
		case 'updateNode':
		case 'updateEdge':
			return `${cmd.type}:${cmd.id}:${Object.keys(cmd.patch).sort().join(',')}`;
		case 'relabelEdges':
			return `relabel:${[...cmd.ids].sort().join(',')}`;
		case 'updateMeta':
			if ('position' in cmd.patch && cmd.patch.position?.kind !== 'other') return null;
			return `meta:${Object.keys(cmd.patch).sort().join(',')}`;
		case 'updateMediaTitle':
			return `media:${cmd.owner.type}:${cmd.owner.id}:${cmd.index}`;
		default:
			return null;
	}
}

export class History {
	private past: StrategyDoc[] = [];
	private future: StrategyDoc[] = [];
	private lastKey: string | null = null;
	private lastAt = 0;

	get canUndo(): boolean {
		return this.past.length > 0;
	}

	get canRedo(): boolean {
		return this.future.length > 0;
	}

	record(before: StrategyDoc, cmd: Command, now: number) {
		const key = editKey(cmd);
		const merges = key !== null && key === this.lastKey && now - this.lastAt < MERGE_MS;
		this.lastKey = key;
		this.lastAt = now;
		this.future = [];
		if (merges) return;
		this.past.push(before);
		if (this.past.length > LIMIT) this.past.shift();
	}

	undo(current: StrategyDoc): StrategyDoc | null {
		const previous = this.past.pop();
		if (!previous) return null;
		this.future.push(current);
		this.lastKey = null;
		return previous;
	}

	redo(current: StrategyDoc): StrategyDoc | null {
		const next = this.future.pop();
		if (!next) return null;
		this.past.push(current);
		this.lastKey = null;
		return next;
	}
}
