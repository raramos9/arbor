import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
	PUBLISHED_COLUMNS,
	parsePublished,
	prepareForPublish,
	type PublishedStrategy,
	type UserId,
} from './model/publishing';
import { PublishedIdSchema, type PublishedId, type Result, type StrategyDoc } from './model/strategy';

type Client = SupabaseClient<Database>;

export async function publish(client: Client, doc: StrategyDoc): Promise<Result<PublishedStrategy>> {
	const upsert = (forkedFrom: PublishedId | null) =>
		client
			.from('published_strategies')
			.upsert({ doc: prepareForPublish(doc).doc, forked_from: forkedFrom }, { onConflict: 'owner,local_id' })
			.select(PUBLISHED_COLUMNS)
			.single();
	let { data, error } = await upsert(doc.origin?.publishedId ?? null);
	if (doc.origin && error?.code === '23503' && error.message.includes('forked_from')) {
		({ data, error } = await upsert(null));
	}
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
