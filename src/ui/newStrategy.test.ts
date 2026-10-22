import { describe, expect, it } from 'vitest';
import { createHint } from './NewStrategyDialog';

const mount = { kind: 'listed', id: 'mount' } as const;

describe('createHint', () => {
	it('says nothing once the plan has a name and a position', () => {
		expect(createHint('Mount game plan', mount)).toBeNull();
	});

	it('asks for a name when the title is cleared', () => {
		expect(createHint('', mount)).toBe('Name the plan to create it.');
		expect(createHint('   ', mount)).toBe('Name the plan to create it.');
	});

	it('asks for the position, or both, when it is missing', () => {
		expect(createHint('Plan', null)).toBe('Name the position to create it.');
		expect(createHint('', null)).toBe('Name the plan and its position to create it.');
	});
});
