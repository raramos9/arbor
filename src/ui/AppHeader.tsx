import { exploreHref } from '../route';
import { cloud } from '../supabase';
import { AccountControl } from './AccountControl';

export function AppHeader({ current }: { current: 'strategies' | 'explore' | null }) {
	return (
		<header className="header app-header">
			<a href="#/" className="wordmark">
				Arbor
			</a>
			<nav className="app-nav" aria-label="Main">
				<a href="#/" aria-current={current === 'strategies' ? 'page' : undefined}>
					Strategies
				</a>
				{cloud && (
					<a href={exploreHref} aria-current={current === 'explore' ? 'page' : undefined}>
						Explore
					</a>
				)}
			</nav>
			{cloud && <AccountControl client={cloud} />}
		</header>
	);
}
