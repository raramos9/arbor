import { describe, expect, it } from 'vitest';
import { armDragDoc } from '../model/fixtures';
import { EdgeIdSchema, NodeIdSchema, type StrategyDoc } from '../model/strategy';
import {
	entrySelection,
	groupSameReaction,
	isLit,
	toOutline,
	reactionPhrase,
	previewLines,
	type OutlineEntry,
	type OutlineStep,
} from './outline';

function graph(nodeNames: string[], links: [string, string, string?][], root = nodeNames[0]!): StrategyDoc {
	const doc = armDragDoc();
	doc.rootNodeId = NodeIdSchema.parse(root);
	doc.nodes = {};
	doc.edges = {};
	doc.layout = {};
	for (const id of nodeNames) {
		doc.nodes[id] = { id: NodeIdSchema.parse(id), name: id.toUpperCase(), notes: '', media: [] };
	}
	links.forEach(([from, to, label = ''], index) => {
		const id = `e${index}`;
		doc.edges[id] = {
			id: EdgeIdSchema.parse(id),
			from: NodeIdSchema.parse(from),
			to: NodeIdSchema.parse(to),
			label,
			notes: '',
			media: [],
		};
	});
	return doc;
}

function rows(entries: readonly OutlineEntry[]): number {
	return entries.reduce((sum, entry) => sum + 1 + (entry.kind === 'step' ? rows(entry.next) : 0), 0);
}

describe('toOutline', () => {
	it('lists a linear chain as nested steps', () => {
		const { start, unlinked } = toOutline(graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c', 'He posts']]));
		expect(unlinked).toEqual([]);
		expect(start).toMatchObject({ kind: 'step', edge: null, reaction: '', node: 'a', name: 'A' });
		const b = start.next[0] as OutlineStep;
		expect(b).toMatchObject({ edge: 'e0', reaction: '', node: 'b' });
		expect(b.next[0]).toMatchObject({ kind: 'step', edge: 'e1', reaction: 'He posts', node: 'c', next: [] });
	});

	it('keeps edge insertion order for siblings', () => {
		const { start } = toOutline(graph(['a', 'b', 'c', 'd'], [['a', 'c'], ['a', 'b'], ['a', 'd']]));
		expect(start.next.map((entry) => entry.node)).toEqual(['c', 'b', 'd']);
	});

	it('turns an edge back to an ancestor into a back jump', () => {
		const { start } = toOutline(graph(['a', 'b'], [['a', 'b'], ['b', 'a', 'He resets']]));
		const b = start.next[0] as OutlineStep;
		expect(b.next).toEqual([{ kind: 'jump', edge: 'e1', reaction: 'He resets', node: 'a', name: 'A', back: true }]);
	});

	it('turns a self loop into a back jump', () => {
		const { start } = toOutline(graph(['a'], [['a', 'a']]));
		expect(start.next).toMatchObject([{ kind: 'jump', node: 'a', back: true }]);
	});

	it('expands a rejoined node once and jumps to it from the second path', () => {
		const { start } = toOutline(graph(['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']]));
		const [b, c] = start.next as OutlineStep[];
		const d = b!.next[0] as OutlineStep;
		expect(d).toMatchObject({ kind: 'step', node: 'd' });
		expect(d.next).toMatchObject([{ kind: 'step', node: 'e' }]);
		expect(c!.next).toMatchObject([{ kind: 'jump', edge: 'e3', node: 'd', back: false }]);
	});

	it('collects nodes unreachable from the start as unlinked lines', () => {
		const { unlinked } = toOutline(graph(['a', 'x', 'y', 'z'], [['x', 'y'], ['y', 'a'], ['z', 'z']]));
		expect(unlinked.map((step) => step.node)).toEqual(['x', 'z']);
		expect(unlinked[0]).toMatchObject({ edge: null, reaction: '' });
		expect((unlinked[0]!.next[0] as OutlineStep).next).toMatchObject([{ kind: 'jump', node: 'a', back: false }]);
		expect(unlinked[1]!.next).toMatchObject([{ kind: 'jump', node: 'z', back: true }]);
	});

	it('stays linear in row count for a chain of diamonds', () => {
		const names = ['n0'];
		const links: [string, string][] = [];
		for (let level = 0; level < 30; level++) {
			const [left, right, join] = [`l${level}`, `r${level}`, `n${level + 1}`];
			names.push(left, right, join);
			links.push([`n${level}`, left], [`n${level}`, right], [left, join], [right, join]);
		}
		const doc = graph(names, links);
		const { start, unlinked } = toOutline(doc);
		expect(unlinked).toEqual([]);
		expect(1 + rows(start.next)).toBe(Object.keys(doc.edges).length + 1);
	});
});

describe('reactionPhrase', () => {
	it('reads an empty reaction as then', () => {
		expect(reactionPhrase('')).toBe('then');
	});
	it('folds a leading "He" into "if he"', () => {
		expect(reactionPhrase('He posts a hand')).toBe('if he posts a hand');
		expect(reactionPhrase('he posts a hand')).toBe('if he posts a hand');
		expect(reactionPhrase('HE posts')).toBe('if he posts');
	});
	it('does not double a typed "if"', () => {
		expect(reactionPhrase('if he posts')).toBe('if he posts');
		expect(reactionPhrase('If he posts')).toBe('if he posts');
		expect(reactionPhrase('if the arm stays')).toBe('if the arm stays');
		expect(reactionPhrase('if ')).toBe('then');
	});
	it('keeps words that only start with if', () => {
		expect(reactionPhrase('iffy grip')).toBe('if iffy grip');
	});
	it('prefixes anything else with if', () => {
		expect(reactionPhrase('Arm stays displaced')).toBe('if Arm stays displaced');
		expect(reactionPhrase('Hello')).toBe('if Hello');
	});
});

describe('isLit', () => {
	const doc = graph(['a', 'b'], [['a', 'b'], ['b', 'a']]);
	const { start } = toOutline(doc);
	const step = start.next[0] as OutlineStep;
	const jump = step.next[0]!;

	it('lights a step for its node or its edge', () => {
		expect(isLit(step, { type: 'node', id: NodeIdSchema.parse('b') })).toBe(true);
		expect(isLit(step, { type: 'edge', id: EdgeIdSchema.parse('e0') })).toBe(true);
		expect(isLit(step, { type: 'node', id: NodeIdSchema.parse('a') })).toBe(false);
		expect(isLit(step, null)).toBe(false);
	});
	it('lights a jump only for its edge', () => {
		expect(isLit(jump, { type: 'edge', id: EdgeIdSchema.parse('e1') })).toBe(true);
		expect(isLit(jump, { type: 'node', id: NodeIdSchema.parse('a') })).toBe(false);
	});
	it('never lights the first row of a line by an edge', () => {
		expect(isLit(start, { type: 'node', id: NodeIdSchema.parse('a') })).toBe(true);
		expect(isLit(start, { type: 'edge', id: EdgeIdSchema.parse('e0') })).toBe(false);
	});
});

describe('entrySelection', () => {
	it('selects the node for a step and the edge for a jump', () => {
		const { start } = toOutline(graph(['a', 'b'], [['a', 'b'], ['b', 'a']]));
		const step = start.next[0] as OutlineStep;
		expect(entrySelection(step)).toEqual({ type: 'node', id: 'b' });
		expect(entrySelection(step.next[0]!)).toEqual({ type: 'edge', id: 'e1' });
	});
});

describe('previewLines', () => {
	it('lists a start-only doc as empty', () => {
		expect(previewLines(toOutline(graph(['a'], [])), 3)).toEqual({ lines: [], more: 0 });
	});

	it('walks depth first in outline order with depth and phrase', () => {
		const doc = graph(['a', 'b', 'c', 'd'], [['a', 'b', 'he stacks'], ['b', 'c'], ['a', 'd', 'if he posts']]);
		expect(previewLines(toOutline(doc), 10)).toEqual({
			lines: [
				{ depth: 0, phrase: 'if he stacks', name: 'B', jump: null },
				{ depth: 1, phrase: 'then', name: 'C', jump: null },
				{ depth: 0, phrase: 'if he posts', name: 'D', jump: null },
			],
			more: 0,
		});
	});

	it('marks jumps back or above', () => {
		const doc = graph(['a', 'b', 'c'], [['a', 'b'], ['a', 'c'], ['b', 'a'], ['c', 'b']]);
		const { lines } = previewLines(toOutline(doc), 10);
		expect(lines.flatMap((line) => ('jump' in line && line.jump ? [[line.name, line.jump]] : []))).toEqual([
			['A', 'back'],
			['B', 'above'],
		]);
	});

	it('counts rows beyond the limit and ignores unlinked nodes', () => {
		const doc = graph(['a', 'b', 'c', 'd', 'x'], [['a', 'b'], ['b', 'c'], ['c', 'd']]);
		const preview = previewLines(toOutline(doc), 2);
		expect(preview.lines.map((line) => 'name' in line && line.name)).toEqual(['B', 'C']);
		expect(preview.more).toBe(1);
	});

	it('lists same-reaction outcomes once under their reaction', () => {
		const doc = graph(
			['a', 'b', 'c', 'd', 'e'],
			[['a', 'b', 'posts arm out'], ['b', 'e', 'he stacks'], ['a', 'c', 'posts arm out'], ['a', 'd', 'he sits back']],
		);
		expect(previewLines(toOutline(doc), 10)).toEqual({
			lines: [
				{ depth: 0, phrase: 'if posts arm out', options: 2 },
				{ depth: 1, phrase: '', name: 'B', jump: null },
				{ depth: 2, phrase: 'if he stacks', name: 'E', jump: null },
				{ depth: 1, phrase: '', name: 'C', jump: null },
				{ depth: 0, phrase: 'if he sits back', name: 'D', jump: null },
			],
			more: 0,
		});
		expect(previewLines(toOutline(doc), 2).more).toBe(3);
	});

	it('spends the budget across a group of outcomes before any outcome descendants', () => {
		const doc = graph(
			['a', 'b', 'c', 'd', 'e', 'f', 'g'],
			[['a', 'b', 'posts'], ['b', 'e'], ['e', 'f'], ['a', 'c', 'posts'], ['a', 'd', 'posts'], ['f', 'g']],
		);
		const preview = previewLines(toOutline(doc), 4);
		expect(preview.lines).toEqual([
			{ depth: 0, phrase: 'if posts', options: 3 },
			{ depth: 1, phrase: '', name: 'B', jump: null },
			{ depth: 1, phrase: '', name: 'C', jump: null },
			{ depth: 1, phrase: '', name: 'D', jump: null },
		]);
		expect(preview.more).toBe(3);
	});

	it('keeps a linear chain in the same order at any limit', () => {
		const doc = graph(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']]);
		expect(previewLines(toOutline(doc), 2).lines.map((line) => 'name' in line && line.name)).toEqual(['B', 'C']);
		expect(previewLines(toOutline(doc), 10).lines.map((line) => line.depth)).toEqual([0, 1, 2]);
	});

	it('never shows a line before its parent', () => {
		const doc = graph(
			['a', 'b', 'c', 'd', 'e', 'f', 'g'],
			[['a', 'b', 'x'], ['b', 'e'], ['e', 'f'], ['a', 'c', 'y'], ['c', 'g'], ['a', 'd', 'z']],
		);
		for (let limit = 0; limit <= 7; limit++) {
			const { lines } = previewLines(toOutline(doc), limit);
			expect(lines).toHaveLength(Math.min(limit, 6));
			let prev = -1;
			for (const line of lines) {
				expect(line.depth).toBeLessThanOrEqual(prev + 1);
				prev = line.depth;
			}
		}
	});

	it('handles a chain longer than the call stack', () => {
		const names = Array.from({ length: 20000 }, (_, i) => `n${i}`);
		const doc = graph(names, names.slice(1).map((name, i): [string, string] => [names[i]!, name]));
		const preview = previewLines(toOutline(doc), 3);
		expect(preview.lines.map((line) => line.depth)).toEqual([0, 1, 2]);
		expect(preview.more).toBe(19996);
	});
});

describe('groupSameReaction', () => {
	const next = (links: [string, string, string?][]) =>
		toOutline(graph(['a', 'b', 'c', 'd', 'e'], links)).start.next;

	it('puts siblings with the same reaction under it once, where the first one was', () => {
		const rows = groupSameReaction(
			next([
				['a', 'b', 'he stands'],
				['a', 'c', 'posts arm out'],
				['a', 'd', 'If Posts arm out '],
				['a', 'e', 'he stands up'],
			]),
		);
		expect(rows.map((row) => row.kind)).toEqual(['entry', 'group', 'entry']);
		expect(rows[1]).toMatchObject({ kind: 'group', phrase: 'if posts arm out' });
		expect(rows[1]!.kind === 'group' && rows[1]!.entries.map((entry) => entry.node)).toEqual(['c', 'd']);
	});

	it('never groups connections without a reaction', () => {
		const rows = groupSameReaction(next([['a', 'b'], ['a', 'c']]));
		expect(rows.map((row) => row.kind)).toEqual(['entry', 'entry']);
	});

	it('groups a jump with steps that share its reaction', () => {
		const rows = groupSameReaction(next([['a', 'b', 'he posts'], ['a', 'b', 'he posts']]));
		expect(rows).toHaveLength(1);
		expect(rows[0]!.kind === 'group' && rows[0]!.entries.map((entry) => entry.kind)).toEqual(['step', 'jump']);
	});
});
