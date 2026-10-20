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
		dialog.addEventListener('cancel', onCancel);
		return () => {
			dialog.removeEventListener('cancel', onCancel);
			dialog.close();
			if (opener?.isConnected) opener.focus();
		};
	}, []);

	function onClick(e: MouseEvent<HTMLDialogElement>) {
		if (e.target !== e.currentTarget) return;
		const box = e.currentTarget.getBoundingClientRect();
		const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
		if (!inside) onClose();
	}

	return (
		<dialog ref={ref} className="dialog" aria-label={label} onClick={onClick}>
			{children}
		</dialog>
	);
}
