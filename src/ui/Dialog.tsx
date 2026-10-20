import { useEffect, type ReactNode } from 'react';

export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	return (
		<div className="backdrop" role="presentation" onClick={onClose}>
			<div className="dialog" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
				{children}
			</div>
		</div>
	);
}
