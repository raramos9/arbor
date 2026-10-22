import { describe, expect, it } from 'vitest';
import { pairSide, POSITIONS, sideAfterPositionChange, startLabel } from './positions';

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
	it('sets the usual side of a listed position', () => {
		expect(sideAfterPositionChange('bottom', 'mount')).toBe('top');
		expect(sideAfterPositionChange('top', 'closed-guard')).toBe('bottom');
		expect(sideAfterPositionChange('top', 'turtle')).toBe('bottom');
		expect(sideAfterPositionChange('bottom', 'standing')).toBe('standing');
		expect(sideAfterPositionChange('standing', 'knee-on-belly')).toBe('top');
	});

	it('keeps the current side for Other, but never standing', () => {
		expect(sideAfterPositionChange('top', 'other')).toBe('top');
		expect(sideAfterPositionChange('bottom', 'other')).toBe('bottom');
		expect(sideAfterPositionChange('standing', 'other')).toBe('bottom');
	});

	it('gives only Standing the standing side', () => {
		for (const p of POSITIONS) expect(p.usualSide === 'standing').toBe(p.id === 'standing');
	});
});

describe('pairSide', () => {
	it('keeps a deliberate top or bottom and pairs standing only with Standing', () => {
		expect(pairSide('bottom', 'mount')).toBe('bottom');
		expect(pairSide('top', 'mount')).toBe('top');
		expect(pairSide('standing', 'mount')).toBe('bottom');
		expect(pairSide('top', 'standing')).toBe('standing');
	});
});
