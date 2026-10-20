import { describe, expect, it } from 'vitest';
import { armDragDoc } from '../model/fixtures';
import { EdgeIdSchema, NodeIdSchema, type StrategyDoc } from '../model/strategy';
import { entrySelection, isLit, toOutline, reactionPhrase, type OutlineEntry, type OutlineStep } from './outline';

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
