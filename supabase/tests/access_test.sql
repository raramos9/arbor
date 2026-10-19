begin;
select plan(13);

insert into auth.users (id, email) values
	('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
	('00000000-0000-0000-0000-00000000000b', 'b@example.com');

select is((select count(*)::int from public.profiles), 2, 'signing up creates a profile');

update public.profiles set handle = 'alice' where id = '00000000-0000-0000-0000-00000000000a';

create function pg_temp.as_user(uid uuid) returns void language sql as $$
	select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
	select set_config('role', 'authenticated', true);
$$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

select lives_ok(
	$$ insert into public.published_strategies (doc) values ('{"id": "s1", "title": "Guard"}') $$,
	'a user with a handle publishes'
);

select lives_ok(
	$$ insert into public.published_strategies (doc) values ('{"id": "s1", "title": "Guard v2"}')
	   on conflict (owner, local_id) do update set doc = excluded.doc $$,
	'republishing the same strategy upserts'
);

select is(
	(select array_agg(title) from public.published_strategies),
	array['Guard v2'],
	'republishing leaves one row with the new document'
);

select throws_ok(
	$$ insert into public.published_strategies (doc) values (jsonb_build_object('id', 'big', 'notes', repeat('x', 600000))) $$,
	'23514',
	null,
	'an oversized document is rejected'
);

select throws_ok(
	$$ insert into public.published_strategies (owner, doc) values ('00000000-0000-0000-0000-00000000000b', '{"id": "s2"}') $$,
	'42501',
	null,
	'a user cannot choose the owner'
);

select throws_ok(
	$$ update public.profiles set handle = 'Not Valid' where id = '00000000-0000-0000-0000-00000000000a' $$,
	'23514',
	null,
	'a malformed handle is rejected'
);

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');

select throws_ok(
	$$ insert into public.published_strategies (doc) values ('{"id": "s3"}') $$,
	'42501',
	null,
	'a user without a handle cannot publish'
);

update public.published_strategies set doc = '{"id": "s1", "title": "Stolen"}';
delete from public.published_strategies;
update public.profiles set handle = 'mallory' where id = '00000000-0000-0000-0000-00000000000a';

select set_config('role', 'postgres', true);

select is(
	(select title from public.published_strategies),
	'Guard v2',
	'another user cannot update or delete the row'
);

select is(
	(select handle from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
	'alice',
	'another user cannot change the handle'
);

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is((select count(*)::int from public.published_strategies), 1, 'anonymous visitors read published strategies');
select is((select count(*)::int from public.profiles), 2, 'anonymous visitors read profiles');

select throws_ok(
	$$ insert into public.published_strategies (doc) values ('{"id": "s4"}') $$,
	'42501',
	null,
	'anonymous visitors cannot publish'
);

select * from finish();
rollback;
