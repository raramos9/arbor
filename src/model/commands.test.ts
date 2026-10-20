import { describe, expect, it } from 'vitest';
import { apply, type ApplyResult, type Command, type MediaOwner } from './commands';
import { armDragDoc } from './fixtures';
import {
	EdgeIdSchema,
	NodeIdSchema,
	parseStrategy,
	type EdgeId,
	type Media,
	type NodeId,
	type StrategyDoc,
} from './strategy';

const nid = (s: string): NodeId => NodeIdSchema.parse(s);
const eid = (s: string): EdgeId => EdgeIdSchema.parse(s);

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

describe('addNode', () => {
	it('adds a node and layout entry', () => {
		const doc = ok(armDragDoc(), { type: 'addNode', id: nid('n'), name: 'Mount', at: { x: 5, y: 6 } });
		expect(doc.nodes[nid('n')]?.name).toBe('Mount');
		expect(doc.layout[nid('n')]).toEqual({ x: 5, y: 6 });
	});
	it('adds without layout', () => {
		const doc = ok(armDragDoc(), { type: 'addNode', id: nid('n'), name: 'X' });
		expect(doc.layout[nid('n')]).toBeUndefined();
	});
	it('refuses a duplicate id', () => {
		refused(armDragDoc(), { type: 'addNode', id: nid('triangle'), name: 'X' });
	});
	it('bumps updatedAt', () => {
		const before = armDragDoc();
		const after = ok(before, { type: 'addNode', id: nid('n'), name: 'X' });
		expect(after.updatedAt).not.toBe(before.updatedAt);
	});
});

describe('addReaction', () => {
	const cmd: Command = {
		type: 'addReaction',
		from: nid('triangle'),
		edge: eid('new-edge'),
		node: nid('new-node'),
		at: { x: 10, y: 20 },
	};
	it('adds the node and the connection to it', () => {
		const doc = ok(armDragDoc(), cmd);
		expect(doc.nodes[nid('new-node')]).toMatchObject({ name: '', notes: '', media: [] });
		expect(doc.edges[eid('new-edge')]).toMatchObject({ from: nid('triangle'), to: nid('new-node'), label: '' });
		expect(doc.layout[nid('new-node')]).toEqual({ x: 10, y: 20 });
	});
	it('refuses an unknown source', () => {
		refused(armDragDoc(), { ...cmd, from: nid('ghost') });
	});
	it('refuses an existing edge id', () => {
		const doc = armDragDoc();
		const existing = Object.keys(doc.edges)[0] ?? '';
		refused(doc, { ...cmd, edge: eid(existing) });
	});
	it('refuses an existing node id', () => {
		refused(armDragDoc(), { ...cmd, node: nid('triangle') });
	});
});

describe('updateNode', () => {
	it('edits name and notes', () => {
		const doc = ok(armDragDoc(), {
			type: 'updateNode',
			id: nid('back-take'),
			patch: { name: 'Back', notes: 'hooks' },
		});
		expect(doc.nodes[nid('back-take')]).toMatchObject({ name: 'Back', notes: 'hooks' });
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'updateNode', id: nid('ghost'), patch: { name: 'x' } });
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
		expect(refused(armDragDoc(), { type: 'deleteNode', id: nid('open-guard') })).toBe(
			'The start node cannot be deleted. Set another node as the start first.',
		);
	});
	it('refuses an unknown node', () => {
		refused(armDragDoc(), { type: 'deleteNode', id: nid('ghost') });
	});
});

describe('connect', () => {
	it('creates an edge with a trimmed label, allows cycles and parallel edges', () => {
		let doc = ok(armDragDoc(), {
			type: 'connect', id: eid('c1'), from: nid('back-take'), to: nid('open-guard'), label: '  ',
		});
		expect(doc.edges[eid('c1')]).toEqual({
			id: 'c1', from: 'back-take', to: 'open-guard', label: '', notes: '', media: [],
		});
		doc = ok(doc, {
			type: 'connect', id: eid('c2'), from: nid('arm-drag'), to: nid('triangle'), label: ' Another ',
		});
		expect(doc.edges[eid('c2')]?.label).toBe('Another');
		expect(Object.keys(doc.edges)).toHaveLength(5);
	});
	it('refuses self-loops', () => {
		refused(armDragDoc(), { type: 'connect', id: eid('c'), from: nid('triangle'), to: nid('triangle'), label: '' });
	});
	it('refuses unknown nodes', () => {
		refused(armDragDoc(), { type: 'connect', id: eid('c'), from: nid('ghost'), to: nid('triangle'), label: '' });
		refused(armDragDoc(), { type: 'connect', id: eid('c'), from: nid('triangle'), to: nid('ghost'), label: '' });
	});
	it('refuses a duplicate edge id', () => {
		refused(armDragDoc(), { type: 'connect', id: eid('e1'), from: nid('triangle'), to: nid('open-guard'), label: '' });
	});
});

describe('updateEdge', () => {
	it('edits label and notes', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { label: ' New ', notes: 'n' } });
		expect(doc.edges[eid('e2')]).toMatchObject({ label: 'New', notes: 'n' });
	});
	it('allows clearing the label', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { label: '' } });
		expect(doc.edges[eid('e2')]?.label).toBe('');
	});
	it('keeps the label when only notes change', () => {
		const doc = ok(armDragDoc(), { type: 'updateEdge', id: eid('e2'), patch: { notes: 'n' } });
		expect(doc.edges[eid('e2')]?.label).toBe('Arm stays displaced');
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
	it('moves the root to another node', () => {
		let doc = ok(armDragDoc(), { type: 'addNode', id: nid('p2'), name: 'Back control' });
		doc = ok(doc, { type: 'setRoot', id: nid('p2') });
		expect(doc.rootNodeId).toBe('p2');
		ok(doc, { type: 'deleteNode', id: nid('open-guard') });
	});
	it('allows any existing node as the start', () => {
		const doc = ok(armDragDoc(), { type: 'setRoot', id: nid('triangle') });
		expect(doc.rootNodeId).toBe('triangle');
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

	it('sets, keeps and clears the position', () => {
		let doc = ok(armDragDoc(), { type: 'updateMeta', patch: { position: { kind: 'listed', id: 'mount' } } });
		expect(doc.position).toEqual({ kind: 'listed', id: 'mount' });
		doc = ok(doc, { type: 'updateMeta', patch: { title: 'Again' } });
		expect(doc.position).toEqual({ kind: 'listed', id: 'mount' });
		doc = ok(doc, { type: 'updateMeta', patch: { position: null } });
		expect(doc.position).toBeNull();
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
