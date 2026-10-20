import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
	PUBLISHED_COLUMNS,
	PublishedIdSchema,
	parsePublished,
	prepareForPublish,
	type PublishedStrategy,
	type UserId,
} from './model/publishing';
import type { Result, StrategyDoc } from './model/strategy';

type Client = SupabaseClient<Database>;

export async function publish(client: Client, doc: StrategyDoc): Promise<Result<PublishedStrategy>> {
	const { data, error } = await client
		.from('published_strategies')
		.upsert({ doc: prepareForPublish(doc).doc }, { onConflict: 'owner,local_id' })
		.select(PUBLISHED_COLUMNS)
		.single();
	if (error) return { ok: false, error: error.message };
	return parsePublished(data);
}

export async function unpublish(client: Client, userId: UserId, localId: string): Promise<Result<null>> {
	const { error } = await client.from('published_strategies').delete().eq('owner', userId).eq('local_id', localId);
	if (error) return { ok: false, error: error.message };
	return { ok: true, value: null };
}

export async function findMine(
	client: Client,
	userId: UserId,
	localId: string,
): Promise<Result<PublishedStrategy | null>> {
	const { data, error } = await client
		.from('published_strategies')
		.select(PUBLISHED_COLUMNS)
		.eq('owner', userId)
		.eq('local_id', localId)
		.maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (data === null) return { ok: true, value: null };
	return parsePublished(data);
}

export async function fetchPublished(client: Client, id: string): Promise<Result<PublishedStrategy | null>> {
	const parsedId = PublishedIdSchema.safeParse(id);
	if (!parsedId.success) return { ok: true, value: null };
	const { data, error } = await client
		.from('published_strategies')
		.select(PUBLISHED_COLUMNS)
		.eq('id', parsedId.data)
		.maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (data === null) return { ok: true, value: null };
	return parsePublished(data);
}
