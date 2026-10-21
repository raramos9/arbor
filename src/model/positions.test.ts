import { describe, expect, it } from 'vitest';
import { startLabel } from './positions';

describe('startLabel', () => {
	it('pairs the position with the side', () => {
		expect(startLabel({ kind: 'listed', id: 'closed-guard' }, 'bottom')).toBe('Closed guard · bottom');
		expect(startLabel({ kind: 'other', name: 'Crucifix' }, 'top')).toBe('Crucifix · top');
	});

	it('says Standing once when both position and side are standing', () => {
		expect(startLabel({ kind: 'listed', id: 'standing' }, 'standing')).toBe('Standing');
		expect(startLabel({ kind: 'other', name: ' standing' }, 'standing')).toBe('Standing');
		expect(startLabel({ kind: 'listed', id: 'standing' }, 'top')).toBe('Standing · top');
	});

	it('uses the listed name when an Other name matches one', () => {
		expect(startLabel({ kind: 'other', name: 'CLOSED GUARD' }, 'bottom')).toBe('Closed guard · bottom');
	});
});
