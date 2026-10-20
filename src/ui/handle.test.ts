import { describe, expect, it } from 'vitest';
import { describeHandleError } from './handle';

describe('describeHandleError', () => {
	it('explains a unique violation', () => {
		expect(describeHandleError({ code: '23505', message: 'duplicate key value' })).toBe('That handle is taken');
	});

	it('passes other messages through', () => {
		expect(describeHandleError({ code: '42501', message: 'permission denied' })).toBe('permission denied');
		expect(describeHandleError({ message: 'Failed to fetch' })).toBe('Failed to fetch');
	});
});
