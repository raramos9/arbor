import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStrategy } from './model/strategy';
import { saveFailure, saveStrategy } from './storage';

const doc = createStrategy({ title: 'Plan', position: null, ruleset: 'both', startingSide: 'bottom' });

function stubSetItem(error: unknown) {
	vi.stubGlobal('localStorage', {
		setItem: () => {
			throw error;
		},
	});
}

function errorOf(saved: ReturnType<typeof saveStrategy>): string {
	return saved.ok ? '' : saved.error;
}

afterEach(() => vi.unstubAllGlobals());

describe('saveFailure', () => {
	it('reads a quota error as full in every browser naming', () => {
		expect(saveFailure(new DOMException('quota', 'QuotaExceededError'))).toBe('full');
		expect(saveFailure(new DOMException('quota', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe('full');
	});

	it('reads anything else as blocked', () => {
		expect(saveFailure(new DOMException('denied', 'SecurityError'))).toBe('blocked');
		expect(saveFailure(new ReferenceError('localStorage is not defined'))).toBe('blocked');
	});
});

describe('saveStrategy', () => {
	it('tells a full quota to free space, not to allow storage', () => {
		stubSetItem(new DOMException('quota', 'QuotaExceededError'));
		const saved = saveStrategy(doc);
		expect(saved).toMatchObject({ ok: false, reason: 'full' });
		expect(errorOf(saved)).toMatch(/full/);
		expect(errorOf(saved)).not.toMatch(/Allow site storage/);
	});

	it('tells blocked storage to allow it', () => {
		stubSetItem(new DOMException('denied', 'SecurityError'));
		const saved = saveStrategy(doc);
		expect(saved).toMatchObject({ ok: false, reason: 'blocked' });
		expect(errorOf(saved)).toMatch(/Allow site storage/);
	});

	it('reports a missing localStorage as blocked', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(saveStrategy(doc)).toMatchObject({ ok: false, reason: 'blocked' });
	});
});
