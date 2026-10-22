import { describe, expect, it } from 'vitest';
import { createStrategy, parseStrategy } from '../model/strategy';
import {
	EXAMPLE_A,
	EXAMPLE_B,
	EXAMPLE_C,
	EXAMPLE_FORK,
	FORK_ADDED,
	heroGraph,
	heroStart,
	homeVisit,
	inSentence,
	planFromTyped,
	treeGraph,
	type Graph,
} from './landing';

describe('planFromTyped', () => {
	it('matches a curated position regardless of case and spacing', () => {
		expect(planFromTyped('  closed   GUARD ')).toEqual({
			title: 'Closed guard game plan',
			position: { kind: 'listed', id: 'closed-guard' },
			startingSide: 'bottom',
		});
	});

	it('follows the shared side rule: standing only for Standing, bottom otherwise', () => {
		expect(planFromTyped('Standing').startingSide).toBe('standing');
		expect(planFromTyped('Mount').startingSide).toBe('bottom');
		expect(planFromTyped('Crucifix').startingSide).toBe('bottom');
	});

	it('keeps an unlisted position in the visitor’s words', () => {
		expect(planFromTyped('Crucifix')).toEqual({
			title: 'Crucifix game plan',
			position: { kind: 'other', name: 'Crucifix' },
			startingSide: 'bottom',
		});
	});

	it('starts a blank plan from empty input', () => {
		expect(planFromTyped('   ')).toEqual({ title: 'My game plan', position: null, startingSide: 'bottom' });
	});

	it('caps the name at the position schema limit', () => {
		const plan = planFromTyped('x'.repeat(80));
		expect(plan.position).toEqual({ kind: 'other', name: 'x'.repeat(60) });
	});

	it('produces strategies that parse, with the root named after the position', () => {
		for (const typed of ['Half guard', 'Crucifix', '']) {
			const doc = createStrategy({ ...planFromTyped(typed), ruleset: 'both' });
			expect(parseStrategy(doc).ok).toBe(true);
			expect(doc.nodes[doc.rootNodeId]?.name).toBe(typed === '' ? 'Start' : typed);
		}
	});
});

describe('homeVisit', () => {
	it('sends anyone with saved strategies home without waiting on auth', () => {
		expect(homeVisit(true, 'loading')).toBe('home');
		expect(homeVisit(true, 'signed-out')).toBe('home');
	});

	it('shows the landing page only to signed-out visitors with nothing saved', () => {
		expect(homeVisit(false, 'signed-out')).toBe('landing');
		expect(homeVisit(false, 'signed-in')).toBe('home');
		expect(homeVisit(false, 'loading')).toBe('checking');
	});
});

describe('example plans', () => {
	it('are valid strategy documents', () => {
		for (const doc of [EXAMPLE_A, EXAMPLE_B, EXAMPLE_C, EXAMPLE_FORK]) expect(parseStrategy(doc).ok).toBe(true);
	});

	it('lay out every node inside the graph bounds', () => {
		const graphs: Graph[] = [heroGraph('wide', ''), heroGraph('tall', ''), treeGraph(EXAMPLE_FORK, { columnGap: 176, rowGap: 104, nodeWidth: 150, pad: 24, yours: FORK_ADDED })];
		for (const graph of graphs) {
			const ids = new Set(graph.nodes.map((n) => n.id));
			for (const n of graph.nodes) {
				expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
				expect(n.x + n.w / 2).toBeLessThanOrEqual(graph.width);
				expect(n.y).toBeLessThanOrEqual(graph.height);
			}
			for (const e of graph.edges) expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
		}
	});

	it('marks only the forked branch as yours', () => {
		const graph = treeGraph(EXAMPLE_FORK, { columnGap: 176, rowGap: 104, nodeWidth: 150, pad: 24, yours: FORK_ADDED });
		expect(graph.nodes.filter((n) => n.tone === 'yours').map((n) => n.name)).toEqual(['Armbar']);
		expect(graph.edges.filter((e) => e.yours).map((e) => e.pill)).toEqual(['if he locks his hands']);
	});
});

describe('hero graph', () => {
	it('names the root after what the visitor types', () => {
		expect(heroStart('')).toEqual({ name: 'Closed guard', side: 'bottom' });
		expect(heroStart('standing')).toEqual({ name: 'Standing', side: 'standing' });
		expect(heroStart('Crucifix')).toEqual({ name: 'Crucifix', side: 'bottom' });
		expect(heroGraph('wide', 'half guard').nodes.find((n) => n.tone === 'start')?.name).toBe('Half guard');
	});

	it('draws each lane with the grammar of its example doc', () => {
		const graph = heroGraph('wide', '');
		const names = new Map(graph.nodes.map((n) => [n.id, n.name]));
		const fromRoot = graph.edges.filter((e) => e.from === 'root' && !e.yours);
		expect(fromRoot.map((e) => [names.get(e.to), e.pill, e.dashed])).toEqual([
			['Break posture', 'then', true],
			['Hip bump', 'then', true],
		]);
		const ends = graph.nodes.filter((n) => n.end).map((n) => n.name);
		expect(ends).toEqual(['Scissor sweep', 'Cross collar choke', 'Kimura', 'Guillotine']);
		for (const doc of [EXAMPLE_A, EXAMPLE_B]) {
			for (const node of Object.values(doc.nodes)) {
				const leaving = Object.values(doc.edges).some((e) => e.from === node.id);
				const drawn = graph.nodes.find((n) => n.id === node.id);
				if (drawn) expect(drawn.end).toBe(!leaving);
			}
		}
	});
});

describe('inSentence', () => {
	it('lowercases a sentence-case name and keeps title-case names', () => {
		expect(inSentence('Closed guard')).toBe('closed guard');
		expect(inSentence('Mount')).toBe('mount');
		expect(inSentence('De La Riva')).toBe('De La Riva');
	});
});
