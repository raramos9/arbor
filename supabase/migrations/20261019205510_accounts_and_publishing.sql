create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	handle text unique check (handle ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$'),
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id) values (new.id);
	return new;
end;
$$;

revoke execute on function private.create_profile() from public, anon, authenticated;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function private.create_profile();

create table public.published_strategies (
	id uuid primary key default gen_random_uuid(),
	owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
	doc jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) < 512000),
	local_id text generated always as (doc ->> 'id') stored not null,
	title text generated always as (doc ->> 'title') stored,
	ruleset text generated always as (doc ->> 'ruleset') stored,
	starting_side text generated always as (doc ->> 'startingSide') stored,
	forked_from uuid references public.published_strategies (id) on delete set null,
	published_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (owner, local_id)
);

create index published_strategies_updated_at_idx on public.published_strategies (updated_at desc);
create index published_strategies_forked_from_idx on public.published_strategies (forked_from);

alter table public.published_strategies enable row level security;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger published_strategies_touch
	before update on public.published_strategies
	for each row execute function private.touch_updated_at();

revoke all on public.profiles, public.published_strategies from anon, authenticated;
grant select on public.profiles, public.published_strategies to anon, authenticated;
grant update (handle) on public.profiles to authenticated;
grant insert (doc, forked_from), update (doc, forked_from), delete on public.published_strategies to authenticated;

create policy "Profiles are public"
	on public.profiles for select
	to anon, authenticated
	using (true);

create policy "Users update their own profile"
	on public.profiles for update
	to authenticated
	using ((select auth.uid()) = id)
	with check ((select auth.uid()) = id);

create policy "Published strategies are public"
	on public.published_strategies for select
	to anon, authenticated
	using (true);

create policy "Users with a handle publish their own strategies"
	on public.published_strategies for insert
	to authenticated
	with check ((select auth.uid()) = owner and exists (select 1 from public.profiles where id = (select auth.uid()) and handle is not null));

create policy "Users update their own published strategies"
	on public.published_strategies for update
	to authenticated
	using ((select auth.uid()) = owner)
	with check ((select auth.uid()) = owner and exists (select 1 from public.profiles where id = (select auth.uid()) and handle is not null));

create policy "Users unpublish their own strategies"
	on public.published_strategies for delete
	to authenticated
	using ((select auth.uid()) = owner);
