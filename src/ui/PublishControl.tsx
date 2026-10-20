import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { Database } from '../database.types';
import { hasChanges, prepareForPublish } from '../model/publishing';
import type { PublishedId, StrategyDoc } from '../model/strategy';
import { findMine, publish, unpublish } from '../publishing';
import { publishedHref } from '../route';
import { Dialog } from './Dialog';
import { HandleDialog } from './HandleDialog';
import { clearPendingPublish, rememberPendingPublish, takePendingPublish } from './pendingPublish';
import { SignInDialog } from './SignInDialog';
import { useSession } from './useSession';

type Remote =
	| { kind: 'checking' }
	| { kind: 'unpublished' }
	| { kind: 'published'; id: PublishedId; publishedDoc: StrategyDoc }
	| { kind: 'error'; message: string };

type DialogState =
	| { kind: 'none' }
	| { kind: 'signing-in' }
	| { kind: 'choosing-handle' }
	| { kind: 'confirm-publish' }
	| { kind: 'confirm-unpublish' };

const COPIED_MS = 2000;

function usePageVisible(): boolean {
	const [visible, setVisible] = useState(() => !document.hidden);
	useEffect(() => {
		const onChange = () => setVisible(!document.hidden);
		document.addEventListener('visibilitychange', onChange);
		return () => document.removeEventListener('visibilitychange', onChange);
	}, []);
	return visible;
}

export function PublishControl({ client, doc }: { client: SupabaseClient<Database>; doc: StrategyDoc }) {
	const [session, setHandle] = useSession(client);
	const [remote, setRemote] = useState<Remote>({ kind: 'checking' });
	const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
	const [busy, setBusy] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const userId = session.status === 'signed-in' ? session.userId : null;
	const signedOut = session.status === 'signed-out';
	const docId = doc.id;

	useEffect(() => {
		if (userId === null) {
			if (signedOut) setRemote({ kind: 'unpublished' });
			else setRemote({ kind: 'checking' });
			return;
		}
		let active = true;
		setRemote({ kind: 'checking' });
		void findMine(client, userId, docId).then((found) => {
			if (!active) return;
			if (!found.ok) setRemote({ kind: 'error', message: found.error });
			else if (found.value === null) setRemote({ kind: 'unpublished' });
			else setRemote({ kind: 'published', id: found.value.id, publishedDoc: found.value.doc });
		});
		return () => {
			active = false;
		};
	}, [client, userId, signedOut, docId]);

	useEffect(() => {
		if (session.status !== 'signed-in') setDialog({ kind: 'none' });
		else setDialog((d) => (d.kind === 'signing-in' ? { kind: 'none' } : d));
	}, [session.status]);

	const settled = session.status === 'signed-in' && remote.kind !== 'checking';
	const resumeTo = session.status === 'signed-in' && remote.kind === 'unpublished' ? (session.handle ? 'confirm-publish' : 'choosing-handle') : null;
	// A magic link signs in every open tab; resume only in the one the user is looking at.
	const visible = usePageVisible();
	useEffect(() => {
		if (!settled || !visible || !takePendingPublish(docId)) return;
		if (resumeTo) setDialog({ kind: resumeTo });
	}, [settled, visible, resumeTo, docId]);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	function closeDialog() {
		setDialog({ kind: 'none' });
		setActionError(null);
	}

	async function runPublish(): Promise<boolean> {
		setBusy(true);
		setActionError(null);
		const result = await publish(client, doc);
		setBusy(false);
		if (!result.ok) {
			setActionError(result.error);
			return false;
		}
		setRemote({ kind: 'published', id: result.value.id, publishedDoc: result.value.doc });
		return true;
	}

	async function onConfirmPublish() {
		if (await runPublish()) closeDialog();
	}

	async function onConfirmUnpublish() {
		if (userId === null) return;
		setBusy(true);
		setActionError(null);
		const result = await unpublish(client, userId, docId);
		setBusy(false);
		if (!result.ok) {
			setActionError(result.error);
			return;
		}
		setRemote({ kind: 'unpublished' });
		closeDialog();
	}

	async function onCopy(id: PublishedId) {
		const link = window.location.origin + window.location.pathname + publishedHref(id);
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : String(e));
		}
	}

	function onPublishClick() {
		setActionError(null);
		if (session.status === 'signed-out') {
			rememberPendingPublish(docId);
			setDialog({ kind: 'signing-in' });
		}
		else if (session.status === 'signed-in') {
			setDialog({ kind: session.handle ? 'confirm-publish' : 'choosing-handle' });
		}
	}

	if (session.status === 'loading') return null;

	const strippedClips = prepareForPublish(doc).strippedClips;

	const dialogs = (() => {
		switch (dialog.kind) {
			case 'none':
				return null;
			case 'signing-in':
				return (
					<SignInDialog
						client={client}
						title="Sign in to publish"
						detail={`Publishing ${doc.title.trim() ? `“${doc.title.trim()}”` : 'this strategy'} needs an account. You’ll come back here after signing in.`}
						onClose={(started) => {
							if (!started) clearPendingPublish();
							closeDialog();
						}}
					/>
				);
			case 'choosing-handle':
				return session.status === 'signed-in' ? (
					<HandleDialog
						client={client}
						userId={session.userId}
						onSaved={(handle) => {
							setHandle(handle);
							setDialog({ kind: 'confirm-publish' });
						}}
						onClose={closeDialog}
					/>
				) : null;
			case 'confirm-publish':
				return (
					<Dialog label="Publish this strategy?" onClose={closeDialog}>
						<div className="form">
							<h2>Publish this strategy?</h2>
							<p className="muted">Anyone with the link can view it.</p>
							{strippedClips > 0 && (
								<p className="muted">
									{strippedClips === 1
										? '1 recorded clip stays on this device and won’t be published.'
										: `${strippedClips} recorded clips stay on this device and won’t be published.`}
								</p>
							)}
							{actionError && <p className="error">{actionError}</p>}
							<div className="row">
								<button type="button" onClick={closeDialog}>
									Cancel
								</button>
								<button type="button" onClick={() => void onConfirmPublish()} disabled={busy}>
									{busy ? 'Publishing…' : 'Publish'}
								</button>
							</div>
						</div>
					</Dialog>
				);
			case 'confirm-unpublish':
				return (
					<Dialog label="Unpublish this strategy?" onClose={closeDialog}>
						<div className="form">
							<h2>Unpublish this strategy?</h2>
							<p className="muted">The link will stop working. Your strategy stays on this device.</p>
							{actionError && <p className="error">{actionError}</p>}
							<div className="row">
								<button type="button" onClick={closeDialog}>
									Cancel
								</button>
								<button type="button" className="danger" onClick={() => void onConfirmUnpublish()} disabled={busy}>
									{busy ? 'Unpublishing…' : 'Unpublish'}
								</button>
							</div>
						</div>
					</Dialog>
				);
			default: {
				const unreachable: never = dialog;
				throw new Error(String(unreachable));
			}
		}
	})();

	const control = (() => {
		switch (remote.kind) {
			case 'checking':
				return (
					<button type="button" disabled>
						Publish
					</button>
				);
			case 'unpublished':
				return (
					<button type="button" onClick={onPublishClick}>
						Publish
					</button>
				);
			case 'error':
				return (
					<>
						<span className="error">{remote.message}</span>
						<button type="button" onClick={onPublishClick}>
							Publish
						</button>
					</>
				);
			case 'published':
				return (
					<>
						<span className="muted">Published</span>
						<button type="button" onClick={() => void onCopy(remote.id)}>
							{copied ? 'Copied' : 'Copy link'}
						</button>
						{hasChanges(doc, remote.publishedDoc) && (
							<button type="button" onClick={() => void runPublish()} disabled={busy}>
								{busy ? 'Updating…' : 'Update'}
							</button>
						)}
						<button
							type="button"
							className="danger"
							onClick={() => {
								setActionError(null);
								setDialog({ kind: 'confirm-unpublish' });
							}}
						>
							Unpublish
						</button>
						{dialog.kind === 'none' && actionError && <span className="error">{actionError}</span>}
					</>
				);
			default: {
				const unreachable: never = remote;
				throw new Error(String(unreachable));
			}
		}
	})();

	return (
		<>
			{control}
			{dialogs}
		</>
	);
}
