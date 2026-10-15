import { parseStrategy, type StrategyDoc } from './strategy';

export const armDragInput = {
	schemaVersion: 1,
	id: 's1',
	title: 'Arm drag from open guard',
	description: '',
	ruleset: 'both',
	startingSide: 'bottom',
	rootNodeId: 'open-guard',
	nodes: {
		'open-guard': { id: 'open-guard', kind: 'position', name: 'Open guard', notes: '', media: [], libraryId: null },
		'arm-drag': { id: 'arm-drag', kind: 'technique', name: 'Arm drag', notes: '', media: [], libraryId: null },
		'back-take': { id: 'back-take', kind: 'technique', name: 'Back take', notes: '', media: [], libraryId: null },
		triangle: { id: 'triangle', kind: 'submission', name: 'Triangle', notes: '', media: [], libraryId: null },
	},
	edges: {
		e1: { id: 'e1', from: 'open-guard', to: 'arm-drag', actor: 'me', label: '', notes: '', media: [] },
		e2: { id: 'e2', from: 'arm-drag', to: 'back-take', actor: 'opponent', label: 'Arm stays displaced', notes: '', media: [] },
		e3: { id: 'e3', from: 'arm-drag', to: 'triangle', actor: 'opponent', label: 'Arm wraps around my back', notes: '', media: [] },
	},
	layout: {},
	createdAt: '2026-10-15T00:00:00Z',
	updatedAt: '2026-10-15T00:00:00Z',
};

export function armDragDoc(): StrategyDoc {
	const parsed = parseStrategy(structuredClone(armDragInput));
	if (!parsed.ok) throw new Error(parsed.error);
	return parsed.value;
}
