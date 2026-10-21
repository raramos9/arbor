const stroke = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.5,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	'aria-hidden': true,
	focusable: false,
} as const;

export function PlusIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 14 14" {...stroke}>
			<path d="M7 2v10M2 7h10" />
		</svg>
	);
}

export function ImportIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 14 14" {...stroke}>
			<path d="M7 1.5v7.5m-3-3 3 3 3-3M2 9.5v1.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V9.5" />
		</svg>
	);
}
