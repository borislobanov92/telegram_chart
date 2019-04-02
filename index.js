import Chart from './src/chart/chart.ts';
import parseData from './src/utils/parse-data.js';
import NightModeButton from "./src/night-mode-button/night-mode-button.js";


async function main () {

	const data = await fetch('chart_data.json')
		.then((r) => r.json())
		.then((rawData) => parseData(rawData));

	const rootElement = document.querySelector('#root');
	const nightModeButtonElement = document.querySelector('.night-mode-button');
	const nightModeButton = new NightModeButton(nightModeButtonElement, false);

	for(let i = 0; i < data.length; i++) {
		const chartContainer = document.createElement('div');
		chartContainer.setAttribute('class', 'chart');
		rootElement.appendChild(chartContainer);

		const chart = new Chart({ rootElement: chartContainer, config: data[i], nightModeButton });

		chart.init();
	}
}


main();
