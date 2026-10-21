import { describe, expect, it } from 'vitest';
import { sideAfterPositionChange, startLabel } from './positions';

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

describe('sideAfterPositionChange', () => {
	it('selects standing for Standing and leaves it for any other position', () => {
		expect(sideAfterPositionChange('bottom', 'standing')).toBe('standing');
		expect(sideAfterPositionChange('standing', 'closed-guard')).toBe('bottom');
		expect(sideAfterPositionChange('standing', 'other')).toBe('bottom');
	});

	it('keeps a deliberate top or bottom', () => {
		expect(sideAfterPositionChange('top', 'mount')).toBe('top');
		expect(sideAfterPositionChange('bottom', 'mount')).toBe('bottom');
	});
});
