export function ViewerScreen({ id }: { id: string }) {
	return (
		<div className="page">
			<header className="header">
				<a href="#/">Strategies</a>
			</header>
			<main className="notice">
				<h2>This strategy isn't available</h2>
				<p>{id}</p>
			</main>
		</div>
	);
}
