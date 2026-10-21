import { cloud } from '../supabase';
import { AppHeader } from './AppHeader';
import { PublishedFeed } from './PublishedFeed';

export function ExploreScreen() {
	if (!cloud) {
		return (
			<div className="page">
				<AppHeader current="explore" />
				<main className="notice">
					<h2>Sharing isn't available</h2>
					<p>Published strategies can't be reached right now.</p>
				</main>
			</div>
		);
	}
	return (
		<div className="page">
			<AppHeader current="explore" />
			<main className="shelf-page">
				<div className="page-head">
					<div className="page-title">
						<h1>Explore</h1>
						<p className="muted">Published game plans, grouped by where they start. See how other people play the same position.</p>
					</div>
				</div>
				<PublishedFeed />
			</main>
		</div>
	);
}
