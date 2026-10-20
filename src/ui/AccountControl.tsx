import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import type { Database } from '../database.types';
import { SignInDialog } from './SignInDialog';
import { useSession } from './useSession';

export function AccountControl({ client }: { client: SupabaseClient<Database> }) {
	const session = useSession(client);
	const [signingIn, setSigningIn] = useState(false);

	switch (session.status) {
		case 'loading':
			return null;
		case 'signed-out':
			return (
				<div className="account">
					<button type="button" onClick={() => setSigningIn(true)}>
						Sign in
					</button>
					{signingIn && <SignInDialog client={client} onClose={() => setSigningIn(false)} />}
				</div>
			);
		case 'signed-in':
			return (
				<div className="account">
					<span className="muted">{session.email}</span>
					<button type="button" onClick={() => void client.auth.signOut()}>
						Sign out
					</button>
				</div>
			);
		default: {
			const unreachable: never = session;
			throw new Error(String(unreachable));
		}
	}
}
