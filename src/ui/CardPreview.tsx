import { previewLines, type Outline } from './outline';

function displayName(name: string): string {
	return name || 'Untitled';
}

// The first lines of a plan as "if he does X, I do Y", shared by Home and Explore cards.
export function CardPreview({ id, outline }: { id: string; outline: Outline }) {
	const { lines, more } = previewLines(outline, 3);
	if (lines.length === 0) {
		return (
			<p id={id} className="preview preview-empty">
				No lines yet
			</p>
		);
	}
	return (
		<ol id={id} className="preview">
			{lines.map((line, index) => (
				<li key={index} style={{ paddingLeft: line.depth * 10 }}>
					{'options' in line ? (
						<em>{line.phrase}</em>
					) : (
						<>
							{line.phrase && <em>{line.phrase} </em>}
							{line.jump === null
								? displayName(line.name)
								: line.jump === 'back'
									? `back to ${displayName(line.name)}`
									: `${displayName(line.name)}, continued above`}
						</>
					)}
				</li>
			))}
			{more > 0 && <li className="preview-more">+{more} more</li>}
		</ol>
	);
}
