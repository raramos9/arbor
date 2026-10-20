import { describe, expect, it } from 'vitest';
import { apply, type Command } from '../model/commands';
import { armDragDoc } from '../model/fixtures';
import { EdgeIdSchema, NodeIdSchema, type StrategyDoc } from '../model/strategy';
import { History } from './history';

const id = (s: string) => NodeIdSchema.parse(s);

function runAll(history: History, start: StrategyDoc, steps: { cmd: Command; at: number }[]): StrategyDoc {
	let doc = start;
	for (const { cmd, at } of steps) {
		const result = apply(doc, cmd);
		if (!result.ok) throw new Error(result.reason);
		history.record(doc, cmd, at);
		doc = result.doc;
	}
	return doc;
}

describe('History', () => {
	it('undoes and redoes a delete', () => {
		const history = new History();
		const start = armDragDoc();
		const after = runAll(history, start, [{ cmd: { type: 'deleteNode', id: id('triangle') }, at: 0 }]);
		expect(after.nodes['triangle']).toBeUndefined();

		const undone = history.undo(after);
		expect(undone?.nodes['triangle']).toBeDefined();
		expect(undone?.edges['e3']).toBeDefined();
		expect(history.canRedo).toBe(true);

		const redone = history.redo(undone!);
		expect(redone?.nodes['triangle']).toBeUndefined();
	});

	it('merges a drag into one step', () => {
		const history = new History();
		const start = armDragDoc();
		const moves = [0, 16, 32, 48].map((at, i) => ({
			cmd: { type: 'moveNode', id: id('arm-drag'), at: { x: i * 10, y: 0 } } as Command,
			at,
		}));
		const after = runAll(history, start, moves);
		expect(history.undo(after)).toBe(start);
		expect(history.canUndo).toBe(false);
	});

	it('keeps edits apart when they pause or change target', () => {
		const history = new History();
		const start = armDragDoc();
		const rename = (name: string, at: number) => ({
			cmd: { type: 'updateNode', id: id('arm-drag'), patch: { name } } as Command,
			at,
		});
		const first = runAll(history, start, [rename('A', 0), rename('Ar', 100)]);
		const second = runAll(history, first, [rename('Arm', 5000)]);
		const third = runAll(history, second, [
			{ cmd: { type: 'updateNode', id: id('triangle'), patch: { name: 'T' } }, at: 5100 },
		]);
		expect(history.undo(third)).toBe(second);
		expect(history.undo(second)).toBe(first);
		expect(history.undo(first)).toBe(start);
	});

	it('merges typing a position name but not picking one', () => {
		const history = new History();
		const start = armDragDoc();
		const meta = (position: Extract<Command, { type: 'updateMeta' }>['patch']['position']): Command => ({
			type: 'updateMeta',
			patch: { position },
		});
		const after = runAll(history, start, [
			{ cmd: meta({ kind: 'listed', id: 'mount' }), at: 0 },
			{ cmd: meta(null), at: 100 },
			{ cmd: meta({ kind: 'other', name: 'W' }), at: 200 },
			{ cmd: meta({ kind: 'other', name: 'Williams' }), at: 300 },
			{ cmd: meta(null), at: 400 },
		]);
		expect(after.position).toBeNull();
		expect(history.undo(after)?.position).toEqual({ kind: 'other', name: 'Williams' });
	});

	it('drops the redo stack after a new edit', () => {
		const history = new History();
		const start = armDragDoc();
		const after = runAll(history, start, [{ cmd: { type: 'deleteEdge', id: EdgeIdSchema.parse('e1') }, at: 0 }]);
		const undone = history.undo(after)!;
		runAll(history, undone, [{ cmd: { type: 'setRoot', id: id('triangle') }, at: 10 }]);
		expect(history.canRedo).toBe(false);
	});
});
