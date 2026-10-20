import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from './database.types';
import { armDragDoc, armDragInput } from './model/fixtures';
import { HandleSchema, PublishedIdSchema } from './model/strategy';
import { publish } from './publishing';

const parentId = PublishedIdSchema.parse('22222222-2222-4222-8222-222222222222');
const forkDoc = () => ({
	...armDragDoc(),
	origin: { publishedId: parentId, title: 'Original', handle: HandleSchema.parse('bo-lee') },
});

type Reply = { data: unknown; error: { code: string; message: string } | null };

function fakeClient(replies: Reply[]) {
	const rows: Array<{ forked_from: string | null }> = [];
	const client = {
		from: () => ({
			upsert: (row: { forked_from: string | null }) => {
				rows.push(row);
				return { select: () => ({ single: () => Promise.resolve(replies.shift()) }) };
			},
		}),
	} as unknown as SupabaseClient<Database>;
	return { client, rows };
}

const fkError = {
	code: '23503',
	message: 'violates foreign key constraint "published_strategies_forked_from_fkey"',
};
const saved = {
	id: '11111111-1111-4111-8111-111111111111',
	doc: armDragInput,
	published_at: '2026-10-16T00:00:00Z',
	updated_at: '2026-10-17T00:00:00Z',
	owner: { id: '33333333-3333-4333-8333-333333333333', handle: 'ana-silva' },
	parent: null,
};

describe('publish', () => {
	it('sends the origin as forked_from', async () => {
		const { client, rows } = fakeClient([{ data: saved, error: null }]);
		const result = await publish(client, forkDoc());
		expect(result.ok).toBe(true);
		expect(rows.map((r) => r.forked_from)).toEqual([parentId]);
	});

	it('retries once without forked_from when the original is gone', async () => {
		const { client, rows } = fakeClient([
			{ data: null, error: fkError },
			{ data: saved, error: null },
		]);
		const result = await publish(client, forkDoc());
		expect(result.ok).toBe(true);
		expect(rows.map((r) => r.forked_from)).toEqual([parentId, null]);
	});

	it('does not retry other errors', async () => {
		const { client, rows } = fakeClient([{ data: null, error: { code: '42501', message: 'denied' } }]);
		const result = await publish(client, forkDoc());
		expect(result).toEqual({ ok: false, error: 'denied' });
		expect(rows).toHaveLength(1);
	});
});
