import { useEffect, useId, useState } from 'react';
import type { PublishedSummary, SummaryCursor, UserId } from '../model/publishing';
import { listPublished } from '../publishing';
import { toOutline, previewLines } from './outline';
import { groupByStart } from './feedGroups';
import { profileHref, publishedHref } from '../route';
import { cloud } from '../supabase';

type FeedState =
	| { kind: 'loading' }
	| { kind: 'error' }
	| { kind: 'ready'; items: PublishedSummary[]; next: SummaryCursor | null; more: 'idle' | 'loading' | 'error' };

export function PublishedFeed({ owner }: { owner?: UserId }) {
	const [state, setState] = useState<FeedState>({ kind: 'loading' });
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
					<div className="feed-groups">
						{groupByStart(state.items).map((group, index) => (
							<section key={group.key} className="feed-group" aria-labelledby={`${headingId}-${index}`}>
								<h2 id={`${headingId}-${index}`} className="feed-group-head">
									{group.heading}
								</h2>
								<ul className="strategy-list">
									{group.items.map((item) => (
										<FeedCard key={item.id} item={item} showHandle={!owner} />
									))}
								</ul>
							</section>
						))}
					</div>
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

function displayName(name: string): string {
	return name || 'Untitled';
}

function FeedCard({ item, showHandle }: { item: PublishedSummary; showHandle: boolean }) {
	const { lines, more } = previewLines(toOutline(item.doc), 3);
	return (
		<li>
			<a href={publishedHref(item.id)}>
				<strong>{item.doc.title || 'Untitled'}</strong>
				<span className="muted">
					{item.doc.ruleset} · {new Date(item.updatedAt).toLocaleDateString()}
				</span>
				{lines.length > 0 && (
					<ol className="preview">
						{lines.map((line, index) => (
							<li key={index} style={{ paddingLeft: line.depth * 12 }}>
								<em>{line.phrase}</em>{' '}
								{line.jump === null
									? displayName(line.name)
									: line.jump === 'back'
										? `back to ${displayName(line.name)}`
										: `${displayName(line.name)}, continued above`}
							</li>
						))}
						{more > 0 && <li className="preview-more">+{more} more</li>}
					</ol>
				)}
			</a>
			{showHandle && <a className="handle-link" href={profileHref(item.handle)}>@{item.handle}</a>}
		</li>
	);
}
