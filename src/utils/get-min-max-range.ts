
export type Range = [number, number];

// Todo refactor this without immutable operations
export default function getMinMaxRange(datasets: Array<{ values: Array<number> }>): Range {
	const allValues = datasets
		.reduce((values, dataset) => values.concat(dataset.values), []);

	return [Math.min.apply(null, allValues), Math.max.apply(null, allValues)];
}
