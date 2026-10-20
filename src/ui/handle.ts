import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { UserId } from '../model/publishing';
import { HandleSchema, type Handle } from '../model/strategy';
import type { Result } from '../model/strategy';

export function describeHandleError(error: { code?: string; message: string }): string {
	return error.code === '23505' ? 'That handle is taken' : error.message;
}

export async function saveHandle(
	client: SupabaseClient<Database>,
	userId: UserId,
	handle: Handle,
): Promise<Result<Handle>> {
	const { data, error } = await client.from('profiles').update({ handle }).eq('id', userId).select('handle').single();
	if (error) return { ok: false, error: describeHandleError(error) };
	const saved = HandleSchema.safeParse(data.handle);
	return saved.success ? { ok: true, value: saved.data } : { ok: false, error: 'The saved handle was not valid' };
}
