import { useEffect, useState } from 'react';
import type { UserId } from '../model/publishing';
import type { Handle } from '../model/strategy';
import { findProfile } from '../publishing';
import { cloud } from '../supabase';
import { AppHeader } from './AppHeader';
import { PublishedFeed } from './PublishedFeed';

type ProfileState =
	| { kind: 'loading' }
	| { kind: 'unavailable' }
	| { kind: 'unknown' }
	| { kind: 'error' }
	| { kind: 'ready'; profile: { id: UserId; handle: Handle } };

export function ProfileScreen({ handle }: { handle: string }) {
	const [state, setState] = useState<ProfileState>({ kind: 'loading' });

	useEffect(() => {
		let stale = false;
		const settle = (next: ProfileState) => {
			if (!stale) setState(next);
		};
		if (!cloud) {
			settle({ kind: 'unavailable' });
			return;
		}
		void findProfile(cloud, handle).then((result) => {
			if (!result.ok) {
				console.warn(`Could not load profile ${handle}: ${result.error}`);
				settle({ kind: 'error' });
			} else if (result.value === null) {
				settle({ kind: 'unknown' });
			} else {
				settle({ kind: 'ready', profile: result.value });
			}
		});
		return () => {
			stale = true;
		};
	}, [handle]);

	const back = <AppHeader current={null} />;

	switch (state.kind) {
		case 'loading':
			return (
				<div className="page">
					{back}
					<main className="notice">
						<p className="muted">Loading…</p>
					</main>
				</div>
			);
		case 'unavailable':
			return (
				<div className="page">
					{back}
					<main className="notice">
						<h2>Sharing isn't available</h2>
						<p>Profiles can't be reached right now.</p>
					</main>
				</div>
			);
		case 'unknown':
			return (
				<div className="page">
					{back}
					<main className="notice">
						<h2>No one has that handle</h2>
						<p>The link may be wrong.</p>
					</main>
				</div>
			);
		case 'error':
			return (
				<div className="page">
					{back}
					<main className="notice">
						<p className="error">Could not load this profile.</p>
					</main>
				</div>
			);
		case 'ready':
			return (
				<div className="page">
					{back}
					<main className="shelf-page">
						<div className="page-head">
							<div className="page-title">
								<h1>@{state.profile.handle}</h1>
								<p className="muted">Published strategies, grouped by where they start.</p>
							</div>
						</div>
						<PublishedFeed owner={state.profile.id} />
					</main>
				</div>
			);
		default: {
			const unreachable: never = state;
			return unreachable;
		}
	}
}
