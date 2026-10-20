import { useEffect, useState } from 'react';
import type { PublishedSummary, SummaryCursor, UserId } from '../model/publishing';
import { listPublished } from '../publishing';
import { profileHref, publishedHref } from '../route';
import { cloud } from '../supabase';

type FeedState =
	| { kind: 'loading' }
	| { kind: 'error' }
	| { kind: 'ready'; items: PublishedSummary[]; next: SummaryCursor | null; more: 'idle' | 'loading' | 'error' };

export function PublishedFeed({ owner }: { owner?: UserId }) {
	const [state, setState] = useState<FeedState>({ kind: 'loading' });

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
	}, [owner]);

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
			return <p className="muted">Loading…</p>;
		case 'error':
			return <p className="error">Could not load published strategies.</p>;
		case 'ready': {
			const { next } = state;
			return (
				<>
					{state.items.length === 0 && <p className="muted">Nothing published yet.</p>}
					<ul className="strategy-list">
						{state.items.map((item) => (
							<li key={item.id}>
								<a href={publishedHref(item.id)}>
									<strong>{item.title || 'Untitled'}</strong>
									<span className="muted">
										{item.ruleset} · starts {item.startingSide} · {new Date(item.updatedAt).toLocaleDateString()}
									</span>
								</a>
								{!owner && <a className="handle-link" href={profileHref(item.handle)}>@{item.handle}</a>}
							</li>
						))}
					</ul>
					{next !== null && (
						<div className="row">
							<button type="button" disabled={state.more === 'loading'} onClick={() => void loadMore(next)}>
								Show more
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
