revoke select on public.published_strategies from anon;

drop policy "Published strategies are public" on public.published_strategies;

create policy "Signed-in users read published strategies"
	on public.published_strategies for select
	to authenticated
	using (true);
