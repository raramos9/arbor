import { useState, type ReactNode } from 'react';
import { cloud } from '../supabase';
import { AppHeader } from './AppHeader';
import { clearPendingReturn, rememberPendingReturn } from './pendingReturn';
import { SignInDialog } from './SignInDialog';
import { useSessionPresence } from './useSessionPresence';

export function SignedInOnly({ title, children }: { title: string; children: ReactNode }) {
	const presence = useSessionPresence(cloud);
	const [signingIn, setSigningIn] = useState(false);

	if (!cloud || presence === 'signed-in') return children;
	if (presence === 'loading') return <div className="page" aria-busy="true" />;

	return (
		<div className="page">
			<AppHeader current={null} />
			<main className="notice">
				<h2>{title}</h2>
				<p>Published game plans are for signed-in members. You’ll come back here after signing in.</p>
				<div>
					<button
						type="button"
						className="primary"
						onClick={() => {
							rememberPendingReturn({ kind: 'open', hash: window.location.hash });
							setSigningIn(true);
						}}
					>
						Sign in
					</button>
				</div>
			</main>
			{signingIn && (
				<SignInDialog
					client={cloud}
					title={title}
					onClose={(started) => {
						if (!started) clearPendingReturn();
						setSigningIn(false);
					}}
				/>
			)}
		</div>
	);
}
