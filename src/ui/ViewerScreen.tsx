import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { forkPublished, type PublishedStrategy } from '../model/publishing';
import { startLabel } from '../model/positions';
import { fetchPublished } from '../publishing';
import { editorHref, navigate, profileHref, publishedHref } from '../route';
import { saveStrategy } from '../storage';
import { cloud } from '../supabase';
import type { Selection } from './flow';
import { BackLink } from './BackLink';
import { Inspector } from './Inspector';
import { OutlinePane } from './OutlinePane';
import { entrySelection, reactionSelection, type OutlineEntry } from './outline';
import { StrategyCanvas } from './StrategyCanvas';
import { useRevealNode } from './useRevealNode';

type ViewerState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; published: PublishedStrategy };

export function ViewerScreen({ id }: { id: string }) {
	const [state, setState] = useState<ViewerState>({ kind: 'loading' });

	useEffect(() => {
		let stale = false;
		const settle = (next: ViewerState) => {
			if (!stale) setState(next);
		};
		if (!cloud) {
			settle({ kind: 'unavailable' });
			return;
		}
		void fetchPublished(cloud, id).then((result) => {
			if (!result.ok) {
				console.warn(`Could not load published strategy ${id}: ${result.error}`);
				settle({ kind: 'unavailable' });
			} else if (result.value === null) {
				settle({ kind: 'unavailable' });
			} else {
				settle({ kind: 'ready', published: result.value });
			}
		});
		return () => {
			stale = true;
		};
	}, [id]);

	switch (state.kind) {
		case 'loading':
			return (
				<div className="page">
					<header className="header">
						<BackLink />
					</header>
					<main className="notice">
						<p className="muted">Loading…</p>
					</main>
				</div>
			);
		case 'unavailable':
			return (
				<div className="page">
					<header className="header">
						<BackLink />
					</header>
					<main className="notice">
						<h2>This strategy isn't available</h2>
						<p>It may have been unpublished, or the link is wrong.</p>
					</main>
				</div>
			);
		case 'ready':
			return (
				<ReactFlowProvider>
					<Viewer published={state.published} />
				</ReactFlowProvider>
			);
		default: {
			const unreachable: never = state;
			return unreachable;
		}
	}
}

function Viewer({ published }: { published: PublishedStrategy }) {
	const { doc, owner, publishedAt, forkedFrom } = published;
	const [selection, setSelection] = useState<Selection>(null);
	const [forkError, setForkError] = useState<string | null>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const { revealNode } = useRevealNode(canvasRef);

	function onFork() {
		const fork = forkPublished(published, new Date().toISOString());
		const saved = saveStrategy(fork);
		if (saved.ok) navigate(editorHref(fork.id));
		else setForkError(saved.error);
	}

	function selectEntry(entry: OutlineEntry) {
		setSelection(entrySelection(entry));
		revealNode(entry.node);
	}

	function selectReaction(leader: OutlineEntry) {
		setSelection(reactionSelection(leader));
		revealNode(leader.node);
	}

	return (
		<div className="page editor-page">
			<header className="header">
				<BackLink />
				<span className="header-sep" />
				<h1>{doc.title || 'Untitled'}</h1>
				{doc.position && (
					<span className="position-chip">
						{startLabel(doc.position, doc.startingSide)}
					</span>
				)}
				<a href={profileHref(owner.handle)}>@{owner.handle}</a>
				<span className="muted">Published {new Date(publishedAt).toLocaleDateString()}</span>
				{forkedFrom && (
					<span className="muted">
						Forked from <a href={publishedHref(forkedFrom.id)}>{forkedFrom.title || 'Untitled'}</a> by <a href={profileHref(forkedFrom.handle)}>@{forkedFrom.handle}</a>
					</span>
				)}
				{forkError && <span className="error">{forkError}</span>}
				<div className="header-actions">
					<button onClick={onFork}>Fork into my strategies</button>
				</div>
			</header>
			<div className="editor">
				<OutlinePane doc={doc} selection={selection} onSelectEntry={selectEntry} onSelectReaction={selectReaction} />
				<div className="canvas" ref={canvasRef}>
					<StrategyCanvas doc={doc} selection={selection} onSelect={setSelection} access={{ mode: 'view' }} />
				</div>
				<Inspector doc={doc} selection={selection} error={null} onSelect={setSelection} access={{ mode: 'view' }} />
			</div>
		</div>
	);
}
