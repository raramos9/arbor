import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Database } from '../database.types';
import { profileHref } from '../route';
import { parseAuthRedirectError } from './authRedirect';
import { HandleDialog } from './HandleDialog';
import { SignInDialog } from './SignInDialog';
import { useSession } from './useSession';

export function AccountControl({ client }: { client: SupabaseClient<Database> }) {
	const [session, setHandle] = useSession(client);
	const [signingIn, setSigningIn] = useState(false);
	const [choosingHandle, setChoosingHandle] = useState(false);
	const [redirectError, setRedirectError] = useState(() => parseAuthRedirectError(window.location.hash));

	useEffect(() => {
		if (redirectError !== null) {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		}
	}, [redirectError]);

	useEffect(() => {
		if (session.status !== 'signed-in') setChoosingHandle(false);
	}, [session.status]);

	switch (session.status) {
		case 'loading':
			return null;
		case 'signed-out':
			return (
				<div className="account">
					{redirectError && <p className="error">{redirectError}</p>}
					<button
						type="button"
						onClick={() => {
							setRedirectError(null);
							setSigningIn(true);
						}}
					>
						Sign in
					</button>
					{signingIn && <SignInDialog client={client} onClose={() => setSigningIn(false)} />}
				</div>
			);
		case 'signed-in':
			return (
				<div className="account">
					{session.handle ? (
						<a href={profileHref(session.handle)}>@{session.handle}</a>
					) : (
						<>
							<span className="muted">{session.email}</span>
							<button type="button" onClick={() => setChoosingHandle(true)}>
								Choose handle
							</button>
						</>
					)}
					<button type="button" onClick={() => void client.auth.signOut()}>
						Sign out
					</button>
					{choosingHandle && (
						<HandleDialog
							client={client}
							userId={session.userId}
							onSaved={(handle) => {
								setHandle(handle);
								setChoosingHandle(false);
							}}
							onClose={() => setChoosingHandle(false)}
						/>
					)}
				</div>
			);
		default: {
			const unreachable: never = session;
			throw new Error(String(unreachable));
		}
	}
}
