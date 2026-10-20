import type { SupabaseClient } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import type { Database } from '../database.types';
import { parseHandle, type Handle, type UserId } from '../model/publishing';
import { Dialog } from './Dialog';
import { saveHandle } from './handle';

type HandleState = { kind: 'editing' } | { kind: 'saving' } | { kind: 'error'; message: string };

export function HandleDialog({
	client,
	userId,
	onSaved,
	onClose,
}: {
	client: SupabaseClient<Database>;
	userId: UserId;
	onSaved: (handle: Handle) => void;
	onClose: () => void;
}) {
	const [input, setInput] = useState('');
	const [state, setState] = useState<HandleState>({ kind: 'editing' });

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (input.trim() === '' || state.kind === 'saving') return;
		const parsed = parseHandle(input);
		if (!parsed.ok) {
			setState({ kind: 'error', message: parsed.error });
			return;
		}
		setState({ kind: 'saving' });
		const saved = await saveHandle(client, userId, parsed.value);
		if (!saved.ok) {
			setState({ kind: 'error', message: saved.error });
			return;
		}
		onSaved(saved.value);
		onClose();
	}

	return (
		<Dialog label="Choose a handle" onClose={onClose}>
			<form className="form" onSubmit={(e) => void onSubmit(e)}>
				<h2>Choose a handle</h2>
				<p className="muted">Your handle appears on strategies you publish.</p>
				<label>
					Handle
					<input
						type="text"
						autoFocus
						autoCapitalize="none"
						spellCheck={false}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						disabled={state.kind === 'saving'}
					/>
				</label>
				{state.kind === 'error' && <p className="error">{state.message}</p>}
				<div className="row">
					<button type="button" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" disabled={input.trim() === '' || state.kind === 'saving'}>
						{state.kind === 'saving' ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
