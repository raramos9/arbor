import { useEffect, useRef, useState } from 'react';
import type { NodeId, StrategyDoc } from '../model/strategy';
import type { Selection } from './flow';
import { isLit, reactionPhrase, toOutline, type Outline, type OutlineEntry, type OutlineStep } from './outline';

type Props = {
	doc: StrategyDoc;
	selection: Selection;
	onSelectEntry: (entry: OutlineEntry) => void;
};

function Chevron({ direction }: { direction: 'left' | 'right' | 'down' }) {
	const path = { left: 'M7.5 2.5 4 6l3.5 3.5', right: 'M4.5 2.5 8 6 4.5 9.5', down: 'M2.5 4.5 6 8l3.5-3.5' }[direction];
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
			<path d={path} />
		</svg>
	);
}

function displayName(name: string): string {
	return name || 'Untitled';
}

function ancestorsOfLit(step: OutlineStep, selection: Selection): NodeId[] | null {
	for (const entry of step.next) {
		if (isLit(entry, selection)) return [step.node];
		if (entry.kind === 'step') {
			const deeper = ancestorsOfLit(entry, selection);
			if (deeper) return [step.node, ...deeper];
		}
	}
	return null;
}

export function OutlinePane({ doc, selection, onSelectEntry }: Props) {
	const [hidden, setHidden] = useState(false);
	const [collapsed, setCollapsed] = useState<ReadonlySet<NodeId>>(new Set());
	const [seenSelection, setSeenSelection] = useState(selection);
	const paneRef = useRef<HTMLElement>(null);
	const outline = toOutline(doc);

	// A new selection reopens collapsed branches above it so the lit row is visible.
	if (selection !== seenSelection) {
		setSeenSelection(selection);
		const ancestors = [outline.start, ...outline.unlinked].flatMap((line) => ancestorsOfLit(line, selection) ?? []);
		if (ancestors.some((id) => collapsed.has(id))) {
			setCollapsed(new Set([...collapsed].filter((id) => !ancestors.includes(id))));
		}
	}

	useEffect(() => {
		paneRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
	}, [selection, hidden]);

	function toggle(id: NodeId) {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
			return next;
		});
	}

	if (hidden) {
		return (
			<nav aria-label="Lines" className="lines rail" ref={paneRef}>
				<button className="lines-toggle" aria-label="Show lines" aria-expanded={false} onClick={() => setHidden(false)}>
					<Chevron direction="right" />
				</button>
			</nav>
		);
	}

	function renderEntry(entry: OutlineEntry, label?: string) {
		const lit = isLit(entry, selection);
		const phrase = entry.kind === 'step' && entry.edge === null ? null : reactionPhrase(entry.reaction);
		const isCollapsed = entry.kind === 'step' && collapsed.has(entry.node);
		const hasChildren = entry.kind === 'step' && entry.next.length > 0;
		const name = displayName(entry.name);
		return (
			<li key={entry.edge ?? entry.node}>
				<div className={`line${lit ? ' lit' : ''}`}>
					{entry.kind === 'step' && hasChildren ? (
						<button
							className="line-disclosure"
							aria-expanded={!isCollapsed}
							aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${name}`}
							onClick={() => toggle(entry.node)}
						>
							<Chevron direction={isCollapsed ? 'right' : 'down'} />
						</button>
					) : (
						<span className="line-disclosure-gap" />
					)}
					<button className="line-row" aria-current={lit ? 'true' : undefined} onClick={() => onSelectEntry(entry)}>
						<span className="line-text">
							{label && <span className="line-label">{label}</span>}
							{phrase !== null && <em>{phrase}</em>}
							{phrase !== null && ' '}
							{entry.kind === 'jump' ? (
								<span className="line-jump">{entry.back ? `back to ${name}` : `${name}, continued above`}</span>
							) : (
								<strong>{name}</strong>
							)}
						</span>
						{entry.kind === 'step' && !hasChildren && <span className="line-dot" aria-hidden="true" />}
					</button>
				</div>
				{entry.kind === 'step' && hasChildren && !isCollapsed && <ul>{entry.next.map((child) => renderEntry(child))}</ul>}
			</li>
		);
	}

	const { start, unlinked }: Outline = outline;
	return (
		<nav aria-label="Lines" className="lines" ref={paneRef}>
			<div className="lines-head">
				<h2>Lines</h2>
				<button className="lines-toggle" aria-label="Hide lines" aria-expanded={true} onClick={() => setHidden(true)}>
					<Chevron direction="left" />
				</button>
			</div>
			<ul>{renderEntry(start, 'Start')}</ul>
			{unlinked.length > 0 && (
				<>
					<p className="lines-group">Not connected</p>
					<ul>{unlinked.map((step) => renderEntry(step))}</ul>
				</>
			)}
		</nav>
	);
}
