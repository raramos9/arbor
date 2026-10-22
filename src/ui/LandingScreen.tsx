import { useCallback, useId, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';
import { POSITIONS, positionName, type PositionId } from '../model/positions';
import type { Result, StrategyDoc } from '../model/strategy';
import { exploreHref } from '../route';
import { cloud } from '../supabase';
import { AccountControl } from './AccountControl';
import { PlusIcon } from './Icons';
import {
	EXAMPLE_A,
	EXAMPLE_B,
	EXAMPLE_C,
	EXAMPLE_FORK,
	FORK_ADDED,
	heroGraph,
	heroStart,
	inSentence,
	planFromTyped,
	POSITION_NAME_LIMIT,
	treeGraph,
	type Graph,
	type GraphEdge,
	type GraphNode,
} from './landing';
import { miniTree } from './miniTree';
import { MiniTreeView } from './MiniTreeView';
import { openNewStrategy } from './NewStrategyDialog';
import { previewLines, reactionPhrase, toOutline, type OutlineStep } from './outline';
import './landing.css';

const EXAMPLES_NOTE = 'Example plans are illustrations, not real users.';

type Start = (typed: string) => Result<null>;

// Navigation waits for hashchange, so the landing stays mounted for a moment and a double click would save twice.
function useStartOnce(): Start {
	const started = useRef(false);
	return useCallback((typed: string) => {
		if (started.current) return { ok: true, value: null };
		started.current = true;
		const opened = openNewStrategy({ ...planFromTyped(typed), ruleset: 'both' });
		if (!opened.ok) started.current = false;
		return opened;
	}, []);
}

export function LandingScreen() {
	const heroInput = useRef<HTMLInputElement>(null);
	const start = useStartOnce();
	return (
		<div className="page landing">
			<header className="header app-header landing-bar">
				<a href="#/" className="wordmark">
					Arbor
				</a>
				{cloud && (
					<nav className="app-nav" aria-label="Main">
						<a href={exploreHref}>Explore</a>
					</nav>
				)}
				<div className="landing-bar-end">
					{cloud && <AccountControl client={cloud} />}
					<button type="button" className="primary" onClick={() => heroInput.current?.focus()}>
						Start a plan
					</button>
				</div>
			</header>
			<main className="landing-main">
				<Hero inputRef={heroInput} start={start} />
				<LinesSection />
				<CompareSection />
				<ShareSection />
				<CloseSection start={start} />
				<footer className="landing-foot">
					<span className="wordmark">Arbor</span>
					<span>{EXAMPLES_NOTE}</span>
				</footer>
			</main>
		</div>
	);
}

function Hero({ inputRef, start }: { inputRef: RefObject<HTMLInputElement>; start: Start }) {
	const descriptionId = useId();
	const [typed, setTyped] = useState('');
	const [failed, setFailed] = useState<string | null>(null);
	const rootName = heroStart(typed).name;
	const startYours = () => {
		const opened = start(typed);
		setFailed(opened.ok ? null : opened.error);
	};
	return (
		<section className="hero" aria-labelledby="landing-title">
			<div className="hero-copy">
				<h1 id="landing-title">
					Everyone has a plan from <em>closed guard</em>. Where’s yours?
				</h1>
				<p className="lede">
					Map what you do, how he reacts, and what you do next. Then line your plan up against everyone else’s from the
					same position.
				</p>
				<StartField inputRef={inputRef} start={start} onType={setTyped} />
			</div>
			<figure className="hero-graph" aria-describedby={descriptionId}>
				<PlanGraph graph={heroGraph('wide', typed)} className="wide-only" animated maxScale={1.1} onStartYours={startYours} />
				<PlanGraph graph={heroGraph('tall', typed)} className="tall-only" animated maxScale={1.1} onStartYours={startYours} />
				{failed && (
					<p className="error" role="alert">
						{failed}
					</p>
				)}
				<figcaption className="examples-note">{EXAMPLES_NOTE}</figcaption>
				<p id={descriptionId} className="visually-hidden">
					{rootName} branching into three plans. Example plan A: then break posture; if he postures, scissor sweep; then
					cross collar choke. Example plan B: then hip bump; if he posts, kimura; if he leans in, guillotine. Your plan is
					still empty.
				</p>
			</figure>
		</section>
	);
}

function StartField({ inputRef, start, onType }: { inputRef?: RefObject<HTMLInputElement>; start: Start; onType?: (typed: string) => void }) {
	const id = useId();
	const [typed, setTyped] = useState('');
	const [error, setError] = useState<string | null>(null);

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		const opened = start(typed);
		setError(opened.ok ? null : `${opened.error} Allow site storage for this page, then try again.`);
	}

	return (
		<form className="start-form" onSubmit={onSubmit}>
			<div className="start-box">
				<label htmlFor={`${id}-position`} className="visually-hidden">
					Starting position
				</label>
				<input
					ref={inputRef}
					id={`${id}-position`}
					className="start-input"
					list={`${id}-positions`}
					value={typed}
					maxLength={POSITION_NAME_LIMIT}
					autoComplete="off"
					placeholder="Your starting position…"
					aria-describedby={`${id}-hint`}
					aria-invalid={error ? true : undefined}
					onChange={(e) => {
						setTyped(e.target.value);
						onType?.(e.target.value);
						setError(null);
					}}
				/>
				<datalist id={`${id}-positions`}>
					{POSITIONS.map((p) => (
						<option key={p.id} value={p.name} />
					))}
				</datalist>
				<button type="submit" className="primary start-submit">
					Start your plan
				</button>
			</div>
			{error ? (
				<p id={`${id}-hint`} className="start-hint error" role="alert">
					{error}
				</p>
			) : (
				<p id={`${id}-hint`} className="start-hint">
					No account needed. Your plan saves in this browser.
				</p>
			)}
		</form>
	);
}

type GraphProps = {
	graph: Graph;
	className?: string;
	animated?: boolean;
	lit?: string | null;
	maxScale?: number;
	onStartYours?: () => void;
};

function edgePath(graph: Graph, from: GraphNode, to: GraphNode): string {
	if (graph.flow === 'right') {
		const mid = (from.x + to.x) / 2;
		return `M${from.x} ${from.y}C${mid} ${from.y} ${mid} ${to.y} ${to.x} ${to.y}`;
	}
	const mid = (from.y + to.y) / 2;
	return `M${from.x} ${from.y}C${from.x} ${mid} ${to.x} ${mid} ${to.x} ${to.y}`;
}

const beat = (n: number) => ({ '--beat': n }) as CSSProperties;

function PlanGraph({ graph, className = '', animated = false, lit = null, maxScale = 1, onStartYours }: GraphProps) {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const at = (x: number, y: number) => ({ left: `${(x / graph.width) * 100}%`, top: `${(y / graph.height) * 100}%` });
	const ends = (e: GraphEdge) => [byId.get(e.from)!, byId.get(e.to)!] as const;
	const root = graph.nodes.find((n) => n.tone === 'start');

	return (
		<div
			className={`plan-graph flow-${graph.flow}${animated ? ' animated' : ''} ${className}`}
			style={
				{ aspectRatio: `${graph.width} / ${graph.height}`, maxWidth: graph.width * maxScale, '--gw': graph.width } as CSSProperties
			}
		>
			<svg viewBox={`0 0 ${graph.width} ${graph.height}`} aria-hidden="true" focusable="false">
				{graph.edges.map((e) => {
					const [from, to] = ends(e);
					return (
						<path
							key={e.id}
							d={edgePath(graph, from, to)}
							pathLength={e.yours ? 1 : undefined}
							className={`g-edge${e.dashed ? ' then' : ''}${e.yours ? ' yours' : ''}`}
							style={beat(e.beat)}
						/>
					);
				})}
			</svg>
			{graph.lanes.map((lane) => (
				<span
					key={lane.id}
					className={`g-lane${lane.yours ? ' yours' : ''}`}
					aria-hidden="true"
					style={{ ...at(lane.x, lane.y), ...beat(lane.beat) }}
				>
					{lane.text}
				</span>
			))}
			{graph.edges.map((e) => {
				if (e.pill === null) return null;
				const [from, to] = ends(e);
				return (
					<span
						key={e.id}
						className={`g-pill${e.yours ? ' yours' : ''}`}
						aria-hidden="true"
						style={{ ...at((from.x + to.x) / 2, (from.y + to.y) / 2), ...beat(e.beat) }}
					>
						{e.pill}
					</span>
				);
			})}
			{graph.nodes.map((n) => {
				const style = { ...at(n.x, n.y), width: `calc(${n.w} * var(--u))`, ...beat(n.beat) };
				const classes = `g-node ${n.tone}${n.id === lit ? ' lit' : ''}`;
				if (n.tone === 'yours' && onStartYours) {
					return (
						<button
							key={n.id}
							type="button"
							className={classes}
							style={style}
							aria-label={`${n.name}: start a ${inSentence(root?.name ?? '')} plan`}
							onClick={onStartYours}
						>
							<PlusIcon size={14} />
							{n.name}
						</button>
					);
				}
				return (
					<div key={n.id} className={classes} style={style} aria-hidden="true">
						{n.meta && <span className="g-meta">{n.meta}</span>}
						<span className="g-name">{n.name}</span>
						{n.end && <span className="g-end" />}
					</div>
				);
			})}
		</div>
	);
}

const LINES_GRAPH = treeGraph(EXAMPLE_A, { columnGap: 196, rowGap: 104, nodeWidth: 164, pad: 24 });
const FORK_GRAPH = treeGraph(EXAMPLE_FORK, { columnGap: 176, rowGap: 104, nodeWidth: 150, pad: 24, yours: FORK_ADDED });

function nodeNamed(doc: StrategyDoc, name: string): string {
	return Object.values(doc.nodes).find((n) => n.name === name)?.id ?? doc.rootNodeId;
}

function LinesSection() {
	const [lit, setLit] = useState(() => nodeNamed(EXAMPLE_A, 'Scissor sweep'));
	const outline = toOutline(EXAMPLE_A);
	const captionId = useId();

	function rows(step: OutlineStep, depth: number) {
		const isLit = step.node === lit;
		const phrase = step.edge === null ? null : reactionPhrase(step.reaction);
		const children = step.next.flatMap((entry) => (entry.kind === 'step' ? [entry] : []));
		return (
			<li key={step.node}>
				<div className={`line${isLit ? ' lit' : ''}`}>
					<span className="line-disclosure-gap" />
					<button type="button" className="line-row" aria-current={isLit ? 'true' : undefined} onClick={() => setLit(step.node)}>
						<span className="line-text">
							{depth === 0 && <span className="line-label">Start</span>}
							{phrase !== null && <em>{phrase} </em>}
							<strong>{step.name}</strong>
						</span>
						{children.length === 0 && <span className="line-dot" aria-hidden="true" />}
					</button>
				</div>
				{children.length > 0 && <ul>{children.map((child) => rows(child, depth + 1))}</ul>}
			</li>
		);
	}

	return (
		<section className="landing-section lines-section" aria-labelledby="lines-title">
			<div className="section-copy">
				<h2 id="lines-title">Read your plan as lines</h2>
				<p>
					Every branch is also a sentence. The lines list follows the graph, so before class you can read the plan top to
					bottom: if he postures, scissor sweep. Pick a line to light its step.
				</p>
			</div>
			<div className="lines-demo">
				<figure className="lines landing-lines" aria-labelledby={captionId}>
					<figcaption id={captionId} className="lines-head">
						<span className="lines-title">Lines</span>
						<span className="muted">Example plan A</span>
					</figcaption>
					<ul>{rows(outline.start, 0)}</ul>
				</figure>
				<PlanGraph graph={LINES_GRAPH} className="demo-graph" lit={lit} />
			</div>
		</section>
	);
}

function ExampleCard({ doc }: { doc: StrategyDoc }) {
	const outline = toOutline(doc);
	const { lines, more } = previewLines(outline, 3);
	return (
		<li className="card">
			<MiniTreeView tree={miniTree(outline)} ruleset={doc.ruleset} />
			<div className="card-body">
				<h3 className="card-title">{doc.title}</h3>
				<ol className="preview">
					{lines.map((line, index) => (
						<li key={index} style={{ paddingLeft: line.depth * 10 }}>
							{'options' in line ? (
								<em>{line.phrase}</em>
							) : (
								<>
									{line.phrase && <em>{line.phrase} </em>}
									{line.name}
								</>
							)}
						</li>
					))}
					{more > 0 && <li className="preview-more">+{more} more</li>}
				</ol>
			</div>
			<div className="card-foot">
				<span>Example</span>
			</div>
		</li>
	);
}

function CompareSection() {
	return (
		<section className="landing-section compare-section" aria-labelledby="compare-title">
			<div className="section-copy">
				<h2 id="compare-title">Compare plans from the same position</h2>
				{cloud ? (
					<p>
						Explore groups published plans by where they start. Open the closed guard shelf and see how other people
						answer the same reactions. <a href={exploreHref}>Open Explore</a>
					</p>
				) : (
					<p>
						Plans are grouped by where they start, so plans from the same position sit side by side and you can see how
						each one answers the same reactions.
					</p>
				)}
			</div>
			<div className="shelf-demo">
				<div className="shelf-head">
					<h3>Closed guard · bottom</h3>
					<span className="muted">3 example approaches</span>
				</div>
				<ul className="card-grid">
					{[EXAMPLE_A, EXAMPLE_B, EXAMPLE_C].map((doc) => (
						<ExampleCard key={doc.id} doc={doc} />
					))}
				</ul>
			</div>
		</section>
	);
}

function ShareSection() {
	return (
		<section className="landing-section share-section" aria-labelledby="share-title">
			<div className="section-copy">
				<h2 id="share-title">Publish a link. Fork someone else’s plan.</h2>
				{cloud ? (
					<p>
						Anyone can open a published plan by its link, no account needed. Sign in to publish yours, or to fork a plan
						and add the branches your game needs.
					</p>
				) : (
					<p>
						A forked plan keeps the original’s lines and lets you add the branches your game needs. Publishing and forking
						aren’t available here right now; your plans still save in this browser.
					</p>
				)}
				<ul className="fork-key">
					<li>
						<span className="key-line" aria-hidden="true" />
						Example plan B, as published
					</li>
					<li>
						<span className="key-line yours" aria-hidden="true" />
						Your fork adds a branch
					</li>
				</ul>
			</div>
			<figure className="fork-demo">
				<PlanGraph graph={FORK_GRAPH} className="demo-graph" />
				<figcaption className="visually-hidden">
					A fork of Example plan B: closed guard, then hip bump; if he posts, kimura; if he leans in, guillotine. The fork
					adds: from kimura, if he locks his hands, armbar.
				</figcaption>
			</figure>
		</section>
	);
}

const QUICK_STARTS: PositionId[] = ['closed-guard', 'half-guard', 'butterfly-guard', 'standing', 'side-control', 'mount'];

function CloseSection({ start }: { start: Start }) {
	const [error, setError] = useState<string | null>(null);
	return (
		<section className="landing-section close-section" aria-labelledby="close-title">
			<h2 id="close-title">Where does your plan start?</h2>
			<StartField start={start} />
			<div className="chips" role="group" aria-label="Start from a common position">
				{QUICK_STARTS.map((id) => {
					const name = positionName({ kind: 'listed', id });
					return (
						<button
							key={id}
							type="button"
							className="chip"
							onClick={() => {
								const opened = start(name);
								setError(opened.ok ? null : opened.error);
							}}
						>
							{name}
						</button>
					);
				})}
			</div>
			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
