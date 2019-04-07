
type Names = {
	[key: string]: string;
}

type LegendChangeEvent = { id: string, checked: boolean };
type Subscriber = (event: LegendChangeEvent) => unknown;

type Config = {
	colors: { [key: string]: string },
	names: Names
}

type CheckboxInfo = {
	id: string,
	text: string,
	color: string,
}

class ChartLegend {

	static getButtonTemplate({ id, text, color }: CheckboxInfo) {
		return `
			<label class="chart-legend__button legend-button">
				<input type="checkbox" checked value="${id}" class="legend-button__checkbox-input">
				<span class="legend-button__checkbox-badge" style="color: ${color}"></span>
				<span class="legend-button__text">${text}</span>
			</label>
		`;
	}

  subscribers: Array<Subscriber> = [];

	constructor(private element: HTMLElement, private config: Config) {}

	init() {
		let uiString = '';

		for(let key in this.config.names) {
			uiString += ChartLegend.getButtonTemplate({
				id: key,
				text: this.config.names[key],
				color: this.config.colors[key]
			});
		}

		this.element.insertAdjacentHTML('beforeend', uiString);
		this.element.addEventListener('change', (event: Event) => {
			event.stopPropagation();
			const targetElement = event.target as HTMLInputElement;

			this.next({ id: targetElement.value, checked: targetElement.checked });
		});
	}

	subscribe(callback: Subscriber) {
		this.subscribers.push(callback);
	}

	next(event: LegendChangeEvent) {
		this.subscribers.forEach((callback) => callback(event));
	}

}

export default ChartLegend;
