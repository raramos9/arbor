import { cloud } from '../supabase';
import { PublishedFeed } from './PublishedFeed';

export function ExploreScreen() {
	if (!cloud) {
		return (
			<div className="page">
				<header className="header">
					<a href="#/">Strategies</a>
				</header>
				<main className="notice">
					<h2>Sharing isn't available</h2>
					<p>Published strategies can't be reached right now.</p>
				</main>
			</div>
		);
	}
	return (
		<div className="page">
			<header className="header">
				<a href="#/">Strategies</a>
				<h1>Explore</h1>
			</header>
			<main className="feed">
				<PublishedFeed />
			</main>
		</div>
	);
}
