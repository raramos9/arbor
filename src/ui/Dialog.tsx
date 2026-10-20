import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';

const FIRST_FIELD = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled)';

export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
	const ref = useRef<HTMLDialogElement>(null);
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	// showModal() makes the page behind inert, so Tab stays inside and screen readers
	// see only the dialog. Focus goes back to whatever opened it when it unmounts.
	useLayoutEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.showModal();
		dialog.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
		const onCancel = (e: Event) => {
			e.preventDefault();
			closeRef.current();
		};
		// Chrome's close watcher can close the dialog without firing cancel. A close
		// queued by a previous cleanup arrives after showModal() reopened it; ignore that.
		const onNativeClose = () => {
			if (!dialog.open) closeRef.current();
		};
		dialog.addEventListener('cancel', onCancel);
		dialog.addEventListener('close', onNativeClose);
		return () => {
			dialog.removeEventListener('cancel', onCancel);
			dialog.removeEventListener('close', onNativeClose);
			dialog.close();
			if (opener?.isConnected) opener.focus();
		};
	}, []);

	// A drag that starts inside the box and ends on the backdrop must not close it.
	const pressedOutside = useRef(false);

	function onMouseDown(e: MouseEvent<HTMLDialogElement>) {
		pressedOutside.current = isOutside(e);
	}

	function onClick(e: MouseEvent<HTMLDialogElement>) {
		if (pressedOutside.current && isOutside(e)) onClose();
	}

	return (
		<dialog ref={ref} className="dialog" aria-label={label} onMouseDown={onMouseDown} onClick={onClick}>
			{children}
		</dialog>
	);
}

function isOutside(e: MouseEvent<HTMLDialogElement>): boolean {
	if (e.target !== e.currentTarget) return false;
	const box = e.currentTarget.getBoundingClientRect();
	return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
}
