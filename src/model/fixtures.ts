import { parseStrategy, type StrategyDoc } from './strategy';

export const armDragInput = {
	schemaVersion: 2,
	id: 's1',
	title: 'Arm drag from open guard',
	description: '',
	ruleset: 'both',
	startingSide: 'bottom',
	rootNodeId: 'open-guard',
	nodes: {
		'open-guard': { id: 'open-guard', name: 'Open guard', notes: '', media: [] },
		'arm-drag': { id: 'arm-drag', name: 'Arm drag', notes: '', media: [] },
		'back-take': { id: 'back-take', name: 'Back take', notes: '', media: [] },
		triangle: { id: 'triangle', name: 'Triangle', notes: '', media: [] },
	},
	edges: {
		e1: { id: 'e1', from: 'open-guard', to: 'arm-drag', label: '', notes: '', media: [] },
		e2: { id: 'e2', from: 'arm-drag', to: 'back-take', label: 'Arm stays displaced', notes: '', media: [] },
		e3: { id: 'e3', from: 'arm-drag', to: 'triangle', label: 'Arm wraps around my back', notes: '', media: [] },
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
