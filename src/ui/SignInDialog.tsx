import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import type { Database } from '../database.types';
import { Dialog } from './Dialog';

type SignInState =
	| { kind: 'editing' }
	| { kind: 'sending' }
	| { kind: 'sent' }
	| { kind: 'error'; message: string };

export function SignInDialog({ client, onClose }: { client: SupabaseClient<Database>; onClose: () => void }) {
	const [email, setEmail] = useState('');
	const [state, setState] = useState<SignInState>({ kind: 'editing' });
	const address = email.trim();

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (address === '' || state.kind === 'sending') return;
		setState({ kind: 'sending' });
		const { error } = await client.auth.signInWithOtp({
			email: address,
			options: { emailRedirectTo: window.location.origin + window.location.pathname },
		});
		setState(error ? { kind: 'error', message: error.message } : { kind: 'sent' });
	}

	return (
		<Dialog label="Sign in" onClose={onClose}>
			{state.kind === 'sent' ? (
				<div className="form">
					<h2>Check your email</h2>
					<p className="muted">We sent a sign-in link to {address}.</p>
					<div className="row">
						<button type="button" onClick={onClose}>
							Close
						</button>
					</div>
				</div>
			) : (
				<form className="form" onSubmit={(e) => void onSubmit(e)}>
					<h2>Sign in</h2>
					<label>
						Email
						<input
							type="email"
							autoFocus
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={state.kind === 'sending'}
						/>
					</label>
					{state.kind === 'error' && <p className="error">{state.message}</p>}
					<div className="row">
						<button type="button" onClick={onClose}>
							Cancel
						</button>
						<button type="submit" disabled={address === '' || state.kind === 'sending'}>
							{state.kind === 'sending' ? 'Sending…' : 'Send link'}
						</button>
					</div>
				</form>
			)}
		</Dialog>
	);
}
