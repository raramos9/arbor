import { z } from 'zod';
import type { Side } from './strategy';

export const POSITIONS = [
	{ id: 'standing', name: 'Standing', usualSide: 'standing' },
	{ id: 'closed-guard', name: 'Closed guard', usualSide: 'bottom' },
	{ id: 'half-guard', name: 'Half guard', usualSide: 'bottom' },
	{ id: 'butterfly-guard', name: 'Butterfly guard', usualSide: 'bottom' },
	{ id: 'de-la-riva', name: 'De La Riva', usualSide: 'bottom' },
	{ id: 'spider-guard', name: 'Spider guard', usualSide: 'bottom' },
	{ id: 'x-guard', name: 'X-guard', usualSide: 'bottom' },
	{ id: 'single-leg-x', name: 'Single leg X', usualSide: 'bottom' },
	{ id: 'side-control', name: 'Side control', usualSide: 'top' },
	{ id: 'mount', name: 'Mount', usualSide: 'top' },
	{ id: 'back', name: 'Back control', usualSide: 'top' },
	{ id: 'turtle', name: 'Turtle', usualSide: 'bottom' },
	{ id: 'north-south', name: 'North-south', usualSide: 'top' },
	{ id: 'knee-on-belly', name: 'Knee on belly', usualSide: 'top' },
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

// Picking a listed position starts you on the side it is usually played from; Other keeps a deliberate top or bottom.
export function sideAfterPositionChange(side: Side, choice: PositionId | 'other'): Side {
	const listed = POSITIONS.find((p) => p.id === choice);
	return listed ? listed.usualSide : pairSide(side, choice);
}

export function otherChoice(name: string): PositionId | 'other' {
	const canonical = canonicalPosition({ kind: 'other', name });
	return canonical.kind === 'listed' ? canonical.id : 'other';
}

// Typing a listed name into Other is the same as picking it, so the side follows only when the match changes.
export function sideAfterOtherNameChange(side: Side, before: string, after: string): Side {
	const next = otherChoice(after);
	return next === otherChoice(before) ? side : sideAfterPositionChange(side, next);
}

// Standing is the only position where the standing side makes sense, and the only one it must pair with.
export function pairSide(side: Side, choice: PositionId | 'other'): Side {
	if (choice === 'standing') return 'standing';
	return side === 'standing' ? 'bottom' : side;
}
