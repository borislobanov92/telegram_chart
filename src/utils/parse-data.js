
// Parse json string to Array objects which has shape below
//
// {
//		timeline: [timestamp1, timestamp2 ..... timestampN],
//		datasets: {
// 			name1: [value1, value2, ... valueN],
// 			name2: [value1, value2, ... valueN]
// 		}
//		types: { name: typeOfChart },
//		names: { name: visibleNameOfChart },
//		color: { name: hexColor },
// }
//

export default function parseData(parsedData) {
	const TIMELINE_TYPE = 'x';

	try {

		return parsedData.map(chartData => {
			const types = chartData.types || {};
			const columns = chartData.columns || [];
			const names = chartData.names || [];
			const colors = chartData.colors || [];

			const nameAxisX = Object.keys(types).find((key) => types[key] === TIMELINE_TYPE);

			const axesData = columns.reduce((memo, currentColumn) => {
				const columnName = currentColumn[0];
				const columnDataset = currentColumn.slice(1);

				if (columnName === nameAxisX) {
					memo.timeline = columnDataset;

					return memo;
				}

				memo.datasets.push({
					values: columnDataset,
					id: columnName,
					color: colors[columnName]
				});

				return memo;
			}, { datasets: [], timeline: [] });

			return {
				types,
				names,
				colors,
				...axesData,
			}
		})
	} catch(e) {
		console.error(e);

		return [];
	}
}
