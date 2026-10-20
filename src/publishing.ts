import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './database.types';
import {
	PAGE_SIZE,
	PUBLISHED_COLUMNS,
	SUMMARY_COLUMNS,
	UserIdSchema,
	parsePublished,
	prepareForPublish,
	toSummaryPage,
	type PublishedStrategy,
	type SummaryCursor,
	type SummaryPage,
	type UserId,
} from './model/publishing';
import {
	HandleSchema,
	PublishedIdSchema,
	type Handle,
	type PublishedId,
	type Result,
	type StrategyDoc,
} from './model/strategy';

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

export async function listPublished(
	client: Client,
	filter: { owner?: UserId; before?: SummaryCursor },
): Promise<Result<SummaryPage>> {
	let query = client
		.from('published_strategies')
		.select(SUMMARY_COLUMNS)
		.order('updated_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(PAGE_SIZE + 1);
	if (filter.owner) query = query.eq('owner', filter.owner);
	if (filter.before) {
		const { updatedAt, id } = filter.before;
		query = query.or(`updated_at.lt."${updatedAt}",and(updated_at.eq."${updatedAt}",id.lt.${id})`);
	}
	const { data, error } = await query;
	if (error) return { ok: false, error: error.message };
	return { ok: true, value: toSummaryPage(data) };
}

export async function findProfile(
	client: Client,
	handle: string,
): Promise<Result<{ id: UserId; handle: Handle } | null>> {
	const parsed = HandleSchema.safeParse(handle);
	if (!parsed.success) return { ok: true, value: null };
	const { data, error } = await client.from('profiles').select('id, handle').eq('handle', parsed.data).maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (data === null) return { ok: true, value: null };
	const profile = z.object({ id: UserIdSchema, handle: HandleSchema }).safeParse(data);
	if (!profile.success) return { ok: false, error: profile.error.message };
	return { ok: true, value: profile.data };
}
