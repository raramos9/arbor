import { describe, expect, it } from 'vitest';
import { apply, defaultActor, type ApplyResult, type Command, type MediaOwner } from './commands';
import { armDragDoc } from './fixtures';
import {
	EdgeIdSchema,
	NodeIdSchema,
	parseReaction,
	parseStrategy,
	type EdgeId,
	type Media,
	type NodeId,
	type StrategyDoc,
} from './strategy';

const nid = (s: string): NodeId => NodeIdSchema.parse(s);
const eid = (s: string): EdgeId => EdgeIdSchema.parse(s);
const reaction = (s: string) => {
	const r = parseReaction(s);
	if (!r) throw new Error('bad reaction');
	return r;
};

function ok(doc: StrategyDoc, cmd: Command): StrategyDoc {
	const result: ApplyResult = apply(doc, cmd);
	if (!result.ok) throw new Error(result.reason);
	expect(parseStrategy(result.doc).ok).toBe(true);
	return result.doc;
}

function refused(doc: StrategyDoc, cmd: Command): string {
	const result = apply(doc, cmd);
	if (result.ok) throw new Error('expected refusal');
	return result.reason;
}

describe('defaultActor', () => {
	it('is me from a position and opponent otherwise', () => {
		expect(defaultActor('position')).toBe('me');
		expect(defaultActor('technique')).toBe('opponent');
		expect(defaultActor('submission')).toBe('opponent');
	});
});

describe('addNode', () => {
	it('adds a node and layout entry', () => {
		const doc = ok(armDragDoc(), { type: 'addNode', id: nid('n'), kind: 'position', name: 'Mount', at: { x: 5, y: 6 } });
		expect(doc.nodes[nid('n')]?.name).toBe('Mount');
		expect(doc.layout[nid('n')]).toEqual({ x: 5, y: 6 });
	});
	it('adds without layout', () => {
		const doc = ok(armDragDoc(), { type: 'addNode', id: nid('n'), kind: 'technique', name: 'X' });
		expect(doc.layout[nid('n')]).toBeUndefined();
	});
	it('refuses a duplicate id', () => {
		refused(armDragDoc(), { type: 'addNode', id: nid('triangle'), kind: 'technique', name: 'X' });
	});
	it('bumps updatedAt', () => {
		const before = armDragDoc();
		const after = ok(before, { type: 'addNode', id: nid('n'), kind: 'technique', name: 'X' });
		expect(after.updatedAt).not.toBe(before.updatedAt);
	});
});

describe('updateNode', () => {
	it('edits name, kind, notes', () => {
		const doc = ok(armDragDoc(), {
			type: 'updateNode',
			id: nid('back-take'),
			patch: { name: 'Back', kind: 'position', notes: 'hooks' },
		});
		expect(doc.nodes[nid('back-take')]).toMatchObject({ name: 'Back', kind: 'position', notes: 'hooks' });
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'updateNode', id: nid('ghost'), patch: { name: 'x' } });
	});
	it('refuses changing the root away from position', () => {
		refused(armDragDoc(), { type: 'updateNode', id: nid('open-guard'), patch: { kind: 'technique' } });
	});
	it('allows renaming the root', () => {
		ok(armDragDoc(), { type: 'updateNode', id: nid('open-guard'), patch: { name: 'Butterfly' } });
	});
});

describe('deleteNode', () => {
	it('cascades edges and layout', () => {
		let doc = ok(armDragDoc(), { type: 'moveNode', id: nid('arm-drag'), at: { x: 1, y: 1 } });
		doc = ok(doc, { type: 'deleteNode', id: nid('arm-drag') });
		expect(doc.nodes[nid('arm-drag')]).toBeUndefined();
		expect(Object.keys(doc.edges)).toHaveLength(0);
		expect(doc.layout[nid('arm-drag')]).toBeUndefined();
	});
	it('keeps unrelated edges', () => {
		const doc = ok(armDragDoc(), { type: 'deleteNode', id: nid('triangle') });
		expect(Object.keys(doc.edges).sort()).toEqual(['e1', 'e2']);
	});
	it('refuses the root', () => {
		refused(armDragDoc(), { type: 'deleteNode', id: nid('open-guard') });
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'deleteNode', id: nid('ghost') });
	});
});

describe('connect', () => {
	it('creates a me edge, allows cycles and parallel edges', () => {
		let doc = ok(armDragDoc(), {
			type: 'connect', id: eid('c1'), from: nid('back-take'), to: nid('open-guard'),
			move: { actor: 'me', label: '  ' },
		});
		expect(doc.edges[eid('c1')]?.label).toBe('');
		doc = ok(doc, {
			type: 'connect', id: eid('c2'), from: nid('arm-drag'), to: nid('triangle'),
			move: { actor: 'opponent', label: reaction('Another') },
		});
		expect(Object.keys(doc.edges)).toHaveLength(5);
	});
	it('refuses self-loops', () => {
		refused(armDragDoc(), {
			type: 'connect', id: eid('c'), from: nid('triangle'), to: nid('triangle'),
			move: { actor: 'me', label: '' },
		});
	});
	it('refuses unknown nodes', () => {
		refused(armDragDoc(), {
			type: 'connect', id: eid('c'), from: nid('ghost'), to: nid('triangle'),
			move: { actor: 'me', label: '' },
		});
		refused(armDragDoc(), {
			type: 'connect', id: eid('c'), from: nid('triangle'), to: nid('ghost'),
			move: { actor: 'me', label: '' },
		});
	});
	it('refuses a duplicate edge id', () => {
		refused(armDragDoc(), {
			type: 'connect', id: eid('e1'), from: nid('triangle'), to: nid('open-guard'),
			move: { actor: 'me', label: '' },
		});
	});
});

describe('updateEdge', () => {
	it('edits label and notes', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { label: ' New ', notes: 'n' } });
		expect(doc.edges[eid('e2')]).toMatchObject({ label: 'New', notes: 'n', actor: 'opponent' });
	});
	it('switches actor to me and keeps label', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { actor: 'me' } });
		expect(doc.edges[eid('e2')]?.actor).toBe('me');
	});
	it('refuses opponent with a blank label', () => {
		refused(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { label: '  ' } });
	});
	it('refuses switching to opponent while the label is blank', () => {
		refused(armDragDoc(), { type: 'updateEdge', id: eid('e1'), patch: { actor: 'opponent' } });
	});
	it('switches to opponent when a label is provided', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e1'), patch: { actor: 'opponent', label: 'Posts' } });
		expect(doc.edges[eid('e1')]?.actor).toBe('opponent');
	});
	it('refuses an unknown edge', () => {
		refused(armDragDoc(), { type: 'updateEdge', id: eid('ghost'), patch: { notes: 'x' } });
	});
});

describe('deleteEdge', () => {
	it('removes the edge only', () => {
		const doc = ok(armDragDoc(), { type: 'deleteEdge', id: eid('e1') });
		expect(Object.keys(doc.edges).sort()).toEqual(['e2', 'e3']);
		expect(Object.keys(doc.nodes)).toHaveLength(4);
	});
	it('refuses an unknown edge', () => {
		refused(armDragDoc(), { type: 'deleteEdge', id: eid('ghost') });
	});
});

describe('moveNode', () => {
	it('writes layout', () => {
		const doc = ok(armDragDoc(), { type: 'moveNode', id: nid('triangle'), at: { x: 10, y: 20 } });
		expect(doc.layout[nid('triangle')]).toEqual({ x: 10, y: 20 });
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'moveNode', id: nid('ghost'), at: { x: 0, y: 0 } });
	});
});

describe('setRoot', () => {
	it('moves the root to another position', () => {
		let doc = ok(armDragDoc(), { type: 'addNode', id: nid('p2'), kind: 'position', name: 'Back control' });
		doc = ok(doc, { type: 'setRoot', id: nid('p2') });
		expect(doc.rootNodeId).toBe('p2');
		ok(doc, { type: 'deleteNode', id: nid('open-guard') });
	});
	it('refuses a non-position', () => {
		refused(armDragDoc(), { type: 'setRoot', id: nid('triangle') });
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'setRoot', id: nid('ghost') });
	});
});

describe('updateMeta', () => {
	it('updates only the given fields', () => {
		const doc = ok(armDragDoc(), { type: 'updateMeta', patch: { title: 'New', ruleset: 'gi', startingSide: 'top' } });
		expect(doc).toMatchObject({ title: 'New', ruleset: 'gi', startingSide: 'top', description: '' });
	});
});

describe('media commands', () => {
	const link: Media = { provider: 'web', title: '', url: 'https://example.com' };
	const second: Media = { provider: 'web', title: 'Second', url: 'https://example.org' };
	const onNode: MediaOwner = { type: 'node', id: nid('arm-drag') };
	const onEdge: MediaOwner = { type: 'edge', id: eid('e2') };

	it('appends media to a node and an edge', () => {
		let doc = ok(armDragDoc(), { type: 'addMedia', owner: onNode, media: link });
		doc = ok(doc, { type: 'addMedia', owner: onNode, media: second });
		doc = ok(doc, { type: 'addMedia', owner: onEdge, media: link });
		expect(doc.nodes[nid('arm-drag')]?.media).toEqual([link, second]);
		expect(doc.edges[eid('e2')]?.media).toEqual([link]);
		expect(doc.edges[eid('e3')]?.media).toEqual([]);
	});
	it('refuses addMedia for an unknown owner', () => {
		refused(armDragDoc(), { type: 'addMedia', owner: { type: 'node', id: nid('ghost') }, media: link });
		refused(armDragDoc(), { type: 'addMedia', owner: { type: 'edge', id: eid('ghost') }, media: link });
	});
	it('does not mix up node and edge ids', () => {
		refused(armDragDoc(), { type: 'addMedia', owner: { type: 'edge', id: eid('arm-drag') }, media: link });
	});
	it('retitles one item and keeps the rest', () => {
		let doc = ok(armDragDoc(), { type: 'addMedia', owner: onEdge, media: link });
		doc = ok(doc, { type: 'addMedia', owner: onEdge, media: second });
		doc = ok(doc, { type: 'updateMediaTitle', owner: onEdge, index: 0, title: 'Drill' });
		expect(doc.edges[eid('e2')]?.media).toEqual([{ ...link, title: 'Drill' }, second]);
		expect(doc.edges[eid('e2')]?.actor).toBe('opponent');
	});
	it('refuses updateMediaTitle for an unknown owner or bad index', () => {
		const doc = ok(armDragDoc(), { type: 'addMedia', owner: onNode, media: link });
		refused(doc, { type: 'updateMediaTitle', owner: { type: 'node', id: nid('ghost') }, index: 0, title: 'x' });
		refused(doc, { type: 'updateMediaTitle', owner: onNode, index: 1, title: 'x' });
		refused(doc, { type: 'updateMediaTitle', owner: onNode, index: -1, title: 'x' });
		refused(doc, { type: 'updateMediaTitle', owner: onNode, index: 0.5, title: 'x' });
	});
	it('removes the item at the index', () => {
		let doc = ok(armDragDoc(), { type: 'addMedia', owner: onNode, media: link });
		doc = ok(doc, { type: 'addMedia', owner: onNode, media: second });
		doc = ok(doc, { type: 'removeMedia', owner: onNode, index: 0 });
		expect(doc.nodes[nid('arm-drag')]?.media).toEqual([second]);
	});
	it('refuses removeMedia for an unknown owner or bad index', () => {
		const doc = ok(armDragDoc(), { type: 'addMedia', owner: onNode, media: link });
		refused(doc, { type: 'removeMedia', owner: { type: 'edge', id: eid('ghost') }, index: 0 });
		refused(doc, { type: 'removeMedia', owner: onNode, index: 1 });
		refused(armDragDoc(), { type: 'removeMedia', owner: onNode, index: 0 });
	});
});
