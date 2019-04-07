

type Column = [string, ...Array<number>];
type RawChartData = {
	columns: Array<Column>;
	types: { [name: string]: string };
  names: { [name: string]: string };
  colors: { [name: string]: string };
}

type Dataset = {
  values: Array<number>;
  name: string;
  color: string;
};
type ParsedData = {
	timeline: Array<DOMTimeStamp>;
	datasets: Array<Dataset>;
  types?: { [name: string]: string };
  names?: { [name: string]: string };
  colors?: { [name: string]: string };
}

export default function parseData(parsedData: Array<RawChartData>): Array<ParsedData> {
	const TIMELINE_TYPE = 'x';

	try {

		return parsedData.map(chartData => {
			const types = chartData.types || {};
			const columns = chartData.columns || [];
			const names = chartData.names || {};
			const colors = chartData.colors || {};

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
