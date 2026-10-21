import { z } from 'zod';
import type { Side } from './strategy';

export const POSITIONS = [
	{ id: 'standing', name: 'Standing' },
	{ id: 'closed-guard', name: 'Closed guard' },
	{ id: 'half-guard', name: 'Half guard' },
	{ id: 'butterfly-guard', name: 'Butterfly guard' },
	{ id: 'de-la-riva', name: 'De La Riva' },
	{ id: 'spider-guard', name: 'Spider guard' },
	{ id: 'x-guard', name: 'X-guard' },
	{ id: 'single-leg-x', name: 'Single leg X' },
	{ id: 'side-control', name: 'Side control' },
	{ id: 'mount', name: 'Mount' },
	{ id: 'back', name: 'Back control' },
	{ id: 'turtle', name: 'Turtle' },
	{ id: 'north-south', name: 'North-south' },
	{ id: 'knee-on-belly', name: 'Knee on belly' },
] as const;

const [first, ...rest] = POSITIONS;

export const PositionIdSchema = z.enum([first.id, ...rest.map((p) => p.id)]);

export const PositionSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('listed'), id: PositionIdSchema }),
	z.object({ kind: z.literal('other'), name: z.string().trim().min(1).max(60) }),
]);

export type PositionId = z.infer<typeof PositionIdSchema>;
export type Position = z.infer<typeof PositionSchema>;

export function positionName(position: Position): string {
	if (position.kind === 'other') return position.name;
	return POSITIONS.find((p) => p.id === position.id)?.name ?? position.id;
}

export function canonicalPosition(position: Position): Position {
	if (position.kind === 'listed') return position;
	const typed = position.name.trim().toLowerCase();
	const listed = POSITIONS.find((p) => p.name.toLowerCase() === typed);
	return listed ? { kind: 'listed', id: listed.id } : position;
}

export function startLabel(position: Position, side: Side): string {
	const canonical = canonicalPosition(position);
	if (canonical.kind === 'listed' && canonical.id === 'standing' && side === 'standing') return 'Standing';
	return `${positionName(canonical)} · ${side}`;
}

// Standing is the only position where the standing side makes sense, and the only one it must pair with.
export function sideAfterPositionChange(side: Side, choice: PositionId | 'other'): Side {
	if (choice === 'standing') return 'standing';
	return side === 'standing' ? 'bottom' : side;
}
