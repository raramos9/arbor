import { useEffect, useId, useState } from 'react';
import type { PublishedSummary, SummaryCursor, UserId } from '../model/publishing';
import { listPublished } from '../publishing';
import { CardPreview } from './CardPreview';
import { toOutline } from './outline';
import { groupByStart } from './feedGroups';
import { miniTree, plural, RULESET_LABEL, timeAgo } from './miniTree';
import { MiniTreeView } from './MiniTreeView';
import { profileHref, publishedHref } from '../route';
import { cloud } from '../supabase';

type FeedState =
	| { kind: 'loading' }
	| { kind: 'error' }
	| { kind: 'ready'; items: PublishedSummary[]; next: SummaryCursor | null; more: 'idle' | 'loading' | 'error' };

export function PublishedFeed({ owner }: { owner?: UserId }) {
	const [state, setState] = useState<FeedState>({ kind: 'loading' });
	const [attempt, setAttempt] = useState(0);
	const [shown, setShown] = useState<string | null>(null);
	const headingId = useId();

	useEffect(() => {
		let stale = false;
		if (!cloud) {
			setState({ kind: 'error' });
			return;
		}
		setState({ kind: 'loading' });
		void listPublished(cloud, { owner }).then((result) => {
			if (stale) return;
			if (!result.ok) {
				console.warn(`Could not list published strategies: ${result.error}`);
				setState({ kind: 'error' });
			} else {
				setState({ kind: 'ready', ...result.value, more: 'idle' });
			}
		});
		return () => {
			stale = true;
		};
	}, [owner, attempt]);

	async function loadMore(before: SummaryCursor) {
		if (!cloud) return;
		setState((current) => (current.kind === 'ready' ? { ...current, more: 'loading' } : current));
		const result = await listPublished(cloud, { owner, before });
		if (!result.ok) console.warn(`Could not load more published strategies: ${result.error}`);
		setState((current) => {
			if (current.kind !== 'ready') return current;
			if (!result.ok) return { ...current, more: 'error' };
			return { kind: 'ready', items: [...current.items, ...result.value.items], next: result.value.next, more: 'idle' };
		});
	}

	switch (state.kind) {
		case 'loading':
			return (
				<div className="card-grid" aria-busy="true">
					<p className="visually-hidden">Loading…</p>
					{[0, 1, 2].map((index) => (
						<div key={index} className="card skeleton" aria-hidden="true">
							<div className="thumb" />
							<div className="card-body">
								<span className="bar" />
								<span className="bar short" />
							</div>
						</div>
					))}
				</div>
			);
		case 'error':
			return (
				<div className="banner">
					<p className="error">Could not load published strategies.</p>
					<div className="row">
						<button type="button" onClick={() => setAttempt((n) => n + 1)}>
							Try again
						</button>
					</div>
				</div>
			);
		case 'ready': {
			const { next } = state;
			const groups = groupByStart(state.items);
			const visible = groups.filter((group) => shown === null || group.key === shown);
			if (state.items.length === 0) {
				return (
					<div className="first-plan">
						<h2>Nothing published yet</h2>
						<p className="muted">Publish a strategy from the editor and it shows up here, next to other plans from the same position.</p>
					</div>
				);
			}
			return (
				<>
					{groups.length > 1 && (
						<div className="chips filter" role="group" aria-label="Starting position">
							<button type="button" className="chip" aria-pressed={shown === null} onClick={() => setShown(null)}>
								All <span className="count">{state.items.length}</span>
							</button>
							{groups.map((group) => (
								<button
									key={group.key}
									type="button"
									className="chip"
									aria-pressed={shown === group.key}
									onClick={() => setShown(shown === group.key ? null : group.key)}
								>
									{group.heading} <span className="count">{group.items.length}</span>
								</button>
							))}
						</div>
					)}
					<div className="shelves">
						{visible.map((group) => (
							<section key={group.key} className="shelf" aria-labelledby={`${headingId}-${groups.indexOf(group)}`}>
								<div className="shelf-head">
									<h2 id={`${headingId}-${groups.indexOf(group)}`}>{group.heading}</h2>
									<span className="muted">{plural(group.items.length, 'approach', 'approaches')}</span>
								</div>
								<ul className="card-grid">
									{group.items.map((item) => (
										<FeedCard key={item.id} item={item} showHandle={!owner} />
									))}
								</ul>
							</section>
						))}
					</div>
					{next !== null && (
						<div className="more-row">
							<button type="button" disabled={state.more === 'loading'} onClick={() => void loadMore(next)}>
								{state.more === 'loading' ? 'Loading…' : 'Show more'}
							</button>
							{state.more === 'error' && <span className="error">Could not load more.</span>}
						</div>
					)}
				</>
			);
		}
		default: {
			const unreachable: never = state;
			return unreachable;
		}
	}
}

function FeedCard({ item, showHandle }: { item: PublishedSummary; showHandle: boolean }) {
	const outline = toOutline(item.doc);
	const id = useId();
	return (
		<li className="card">
			<a
				href={publishedHref(item.id)}
				className="card-link"
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-meta ${id}-preview`}
			>
				<MiniTreeView tree={miniTree(outline)} />
				<div className="card-body">
					<h3 id={`${id}-title`} className="card-title">
						{item.doc.title || 'Untitled'}
					</h3>
					<p className="card-start">{RULESET_LABEL[item.doc.ruleset]}</p>
					<CardPreview id={`${id}-preview`} outline={outline} />
				</div>
			</a>
			<div className="card-foot">
				{showHandle && (
					<a className="handle-link" href={profileHref(item.handle)}>
						@{item.handle}
					</a>
				)}
				<span id={`${id}-meta`}>
					<span className="visually-hidden">{item.doc.ruleset}, updated </span>
					{timeAgo(item.updatedAt)}
				</span>
			</div>
		</li>
	);
}
