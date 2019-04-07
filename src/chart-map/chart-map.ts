import hexToRGB from '../utils/hex-to-rgb.js';
import getCoords from '../utils/get-coords.js';
import getMinMaxRange from '../utils/get-min-max-range.js';

import { Dataset, Viewport } from "../models";
import NightModeButton from '../night-mode-button/night-mode-button.js';

const MIN_WIDTH_VIEWPORT = 40;

function getTranslateValue(transform: string): number {
	return +transform.replace(/[^\d.]/g, '');
}

type InternalDataset = Dataset &  {
  ratioY: number,
  targetRatioY: number,
};

type Subscriber = (nextViewport: Viewport) => unknown;

type Config = {
	datasets: Array<Dataset>,
	viewport: Viewport,
	timeline: Array<DOMTimeStamp>;
};

type InternalViewportChangeEvent = {
	nextOffset: number;
	nextWidth: number;
};

type Props = {
	rootElement: HTMLElement;
	config: Config;
	nightModeButton: NightModeButton;
};

class ChartMap {

	static getTemplate() {
		return `
			<div class="chart-map__wrap">
				<canvas 
					class="chart-map__canvas">
				</canvas>

				<div class="chart-map__slider">
					<div class="chart-map__hand chart-map__left-hand"></div>
					<div class="chart-map__hand chart-map__right-hand"></div>
				</div>
      </div>
		`;
	}

  rootElement: HTMLElement;
	config: Config;
	datasets: Array<InternalDataset>;
	timeline: Array<DOMTimeStamp>;
	viewport: Viewport;
  nightModeButton: NightModeButton;
  canvas: HTMLCanvasElement;
  sliderElement: HTMLElement;
  leftHandElement: HTMLElement;
  rightHandElement: HTMLElement;
  canvasSize: ClientRect;
  devicePixelRatio: number;
  ctx: CanvasRenderingContext2D;

  ratioY: number;
  ratioX: number;
  prevTs: number;

  shouldRender: boolean = true;
  isNightMode: boolean = false;

  subscribers: Array<Subscriber>;

  maxY: number = 0;
  minY: number = 0;

	constructor({ rootElement, config, nightModeButton }: Props) {
		this.rootElement = rootElement;
		this.config = config;
		this.nightModeButton = nightModeButton;

		this.timeline = this.config.timeline || [];
		this.viewport = this.config.viewport || { start: 0.7, end: 1 };
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', ChartMap.getTemplate());
		this.canvas = this.rootElement.querySelector('.chart-map__canvas');
		this.ctx = this.canvas.getContext('2d');
		this.sliderElement = this.rootElement.querySelector('.chart-map__slider');
		this.leftHandElement = this.rootElement.querySelector('.chart-map__left-hand');
		this.rightHandElement = this.rootElement.querySelector('.chart-map__right-hand');
		this.canvasSize = this.canvas.getBoundingClientRect();
		this.devicePixelRatio = window.devicePixelRatio || 1;

		[this.minY, this.maxY] = getMinMaxRange(this.config.datasets);

		this.updateSizes();
		this.addEventListeners();

		this.nightModeButton.subscribe(isNightMode => {
			this.isNightMode = isNightMode;
			this.sliderElement.style.boxShadow = this.isNightMode
				? '0 20px 20px 9999px #17242f96'
				: '0 20px 20px 9999px #e0e2e466';
		});
	}

	addEventListeners() {
		this.sliderElement.addEventListener('touchstart', (event) => this.sliderTouchHandle(event, true));
		this.leftHandElement.addEventListener('touchstart', (event) => this.leftHandTouchHandle(event, true));
		this.rightHandElement.addEventListener('touchstart', (event) => this.rightHandTouchHandle(event, true));

		this.sliderElement.addEventListener('mousedown', (event) => this.sliderTouchHandle(event));
		this.leftHandElement.addEventListener('mousedown', (event) => this.leftHandTouchHandle(event));
		this.rightHandElement.addEventListener('mousedown', (event) => this.rightHandTouchHandle(event));
	};

	subscribe(callback: Subscriber) {
		this.subscribers.push(callback);
	}

	fireChangeViewportEvent(event: InternalViewportChangeEvent) {
		const { nextOffset, nextWidth } = event;

		this.viewport = {
			start: Math.max(0, nextOffset / this.canvasSize.width),
			end: Math.min(1, (nextOffset + nextWidth) / this.canvasSize.width)
		};

		this.subscribers.forEach((callback) => callback(this.viewport));
	}

	toggleDataset({ id, checked } : { id: string; checked: boolean }) {
		if (checked) {
			this.turnOnDataset(id);
		} else {
			this.turnOffDataset(id);
		}
	}

	turnOffDataset(id: String) {
		const stayOnDatasets = [];
		this.shouldRender = true;

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].name === id) {
				this.datasets[i].targetOpacity = 0;
			}

			if (this.datasets[i].targetOpacity === 1){
				stayOnDatasets.push(this.datasets[i]);
			}
		}

		[this.minY, this.maxY] = getMinMaxRange(stayOnDatasets);

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < stayOnDatasets.length; i++) {
			stayOnDatasets[i].targetRatioY = newRatioY;
		}
	}

	turnOnDataset(id: String) {
		[this.minY, this.maxY] = getMinMaxRange(this.datasets);
		this.shouldRender = true;

		const newRatioY = this.canvasSize.height / (this.maxY - this.minY);

		for (let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].name === id) {
				this.datasets[i].targetOpacity = 1;
				this.datasets[i].ratioY = newRatioY;
			}

			this.datasets[i].targetRatioY = newRatioY;
		}
	}

	updateSizes() {
		this.canvasSize = this.canvas.getBoundingClientRect();
		this.canvas.width = this.canvasSize.width * this.devicePixelRatio;
		this.canvas.height = this.canvasSize.height * this.devicePixelRatio;

		this.ratioY = this.canvasSize.height / (this.maxY - this.minY);
		this.ratioX = this.canvasSize.width / (this.timeline[this.timeline.length - 1] - this.timeline[0]);

		this.sliderElement.style.width = `${(this.viewport.end - this.viewport.start) * this.canvasSize.width}px`;
		this.sliderElement.style.transform = `translateX(${this.viewport.start * this.canvasSize.width}px)`;

		this.datasets = this.config.datasets
			.map((dataset) => ({
					...dataset,
					ratioY: this.ratioY,
					targetRatioY: this.ratioY,
					opacity: 1,
					targetOpacity: 1,
				})
			);

		this.shouldRender = true;
	}

	update(ts: DOMTimeStamp) {
		if (!this.shouldRender) {
			return;
		}

		const prevTs = this.prevTs || ts;
		const delta = Math.min(50, ts - prevTs);

		// update prev timestamp
		this.prevTs = ts;

		const k = 0.008 * delta;
		let shouldRenderOnNextTick = false;

		// update datasets params
		for (let i = 0; i < this.datasets.length; i++) {
			const opacityDiff = this.datasets[i].targetOpacity - this.datasets[i].opacity;
			const ratioYDiff = this.datasets[i].targetRatioY - this.datasets[i].ratioY;

			if (Math.abs(opacityDiff) < Number.EPSILON) {
				this.datasets[i].opacity = this.datasets[i].targetOpacity;
			} else {
				this.datasets[i].opacity += k * opacityDiff;
				shouldRenderOnNextTick = true;
			}

			if (Math.abs(ratioYDiff) < Number.EPSILON) {
				this.datasets[i].ratioY = this.datasets[i].targetRatioY;
			} else {
				this.datasets[i].ratioY += k * ratioYDiff;
				shouldRenderOnNextTick = true;
			}
		}

		this.shouldRender = shouldRenderOnNextTick;
		this.ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
		this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
		this.datasets.forEach((dataset) => this.drawChart(dataset));
	}

	drawChart(dataset: InternalDataset) {
		const { values, color = 'red', ratioY, opacity } = dataset;

		this.ctx.save();
		this.ctx.lineWidth = 2;
		this.ctx.lineJoin = 'round';
		this.ctx.beginPath();
		this.ctx.strokeStyle = hexToRGB(color, opacity);

		for (let i = 0; i < values.length; i++) {
			const y = this.canvasSize.height - Math.floor((values[i] - this.minY) * ratioY);
			const x = Math.floor((this.timeline[i] - this.timeline[0]) * this.ratioX);

			this.ctx.lineTo(x, y);
		}

		this.ctx.stroke();
		this.ctx.restore();
	}

  sliderTouchHandle(rawEvent: TouchEvent | MouseEvent, isTouchEvent = false) {
		const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

		const moveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
		const upEvent = isTouchEvent ? 'touchend' : 'mouseup';
		const wrapCoords = getCoords(this.canvas);
		const coords = getCoords(event.target);
		const startX = coords.left - wrapCoords.left;
		const originEventX = event.pageX;
		const leftShift = event.pageX - coords.left;
		const rightShift = coords.right - event.pageX;
		const width = this.sliderElement.clientWidth;

		const move = (rawEvent: TouchEvent | MouseEvent) => {
      rawEvent.stopImmediatePropagation();

      const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

			const delta = event.pageX - originEventX;

			if ((event.pageX - leftShift) < wrapCoords.left) {
				this.sliderElement.style.transform =`translateX(${0}px)`;
				this.fireChangeViewportEvent({
					nextOffset: 0,
					nextWidth: width
				});

				return;
			}

			if ((event.pageX + rightShift) > wrapCoords.right ){
				this.sliderElement.style.transform =`translateX(${wrapCoords.width - coords.width}px)`;
				this.fireChangeViewportEvent({
					nextOffset: wrapCoords.width - coords.width,
					nextWidth: width
				});

				return;
			}

			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			this.fireChangeViewportEvent({
				nextOffset: startX + delta,
				nextWidth: width
			});
		};

		function cleanUp() {
			document.removeEventListener(moveEvent, move);
			document.removeEventListener(upEvent, cleanUp);
		}

		document.addEventListener(moveEvent, move);
		document.addEventListener(upEvent, cleanUp);
	}

	rightHandTouchHandle(rawEvent: TouchEvent | MouseEvent, isTouchEvent = false) {
    rawEvent.stopImmediatePropagation();

    const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

		const moveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
		const upEvent = isTouchEvent ? 'touchend' : 'mouseup';
		const wrapCoords = getCoords(this.canvas);
		const sliderCoords = getCoords(this.sliderElement);
		const originEventX = event.pageX;
		const originWidth = this.sliderElement.clientWidth;
		const offset = getTranslateValue(this.sliderElement.style.transform);

		const changeWidth = (rawEvent: TouchEvent | MouseEvent) => {
      rawEvent.stopImmediatePropagation();

      const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

			const delta = event.pageX - originEventX;
			const newWidth = originWidth + delta;

			if (newWidth < MIN_WIDTH_VIEWPORT) {
				this.sliderElement.style.width = `${MIN_WIDTH_VIEWPORT}px`;
				this.fireChangeViewportEvent({
					nextOffset: offset,
					nextWidth: MIN_WIDTH_VIEWPORT
				});

				return;
			}

			if ((newWidth + (sliderCoords.left - wrapCoords.left)) >= (wrapCoords.right - wrapCoords.left)) {
				this.sliderElement.style.width = `${wrapCoords.right - sliderCoords.left}px`;
				this.fireChangeViewportEvent({
					nextOffset: offset,
					nextWidth: wrapCoords.right - sliderCoords.left
				});

				return;
			}

			this.sliderElement.style.width = `${originWidth + delta}px`;
			this.fireChangeViewportEvent({
				nextOffset: offset,
				nextWidth: originWidth + delta
			});
		};

		function cleanUp() {
			document.removeEventListener(moveEvent, changeWidth);
			document.removeEventListener(upEvent, cleanUp);
		}

		document.addEventListener(moveEvent, changeWidth);
		document.addEventListener(upEvent, cleanUp);
	}

	leftHandTouchHandle(rawEvent: TouchEvent | MouseEvent, isTouchEvent = false) {
    rawEvent.stopImmediatePropagation();

    const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

		const moveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
		const upEvent = isTouchEvent ? 'touchend' : 'mouseup';
		const wrapCoords = getCoords(this.canvas);
		const sliderCoords = getCoords(this.sliderElement);

		const startX = sliderCoords.left - wrapCoords.left;
		const originEventX = event.pageX;
		const originWidth = this.sliderElement.clientWidth;
		const leftShiftX = event.pageX - sliderCoords.left;

		const changeWidth = (rawEvent: TouchEvent | MouseEvent) => {
      rawEvent.stopImmediatePropagation();

      const event = isTouchEvent ? (rawEvent as TouchEvent).touches[0] : rawEvent as MouseEvent;

			const delta = event.pageX - originEventX;
			const newWidth = originWidth + -1 * delta;

			if (newWidth < MIN_WIDTH_VIEWPORT) {
				const nextOffset = sliderCoords.right - wrapCoords.left - MIN_WIDTH_VIEWPORT;
				const nextWidth = MIN_WIDTH_VIEWPORT;

				this.sliderElement.style.width = `${nextWidth}px`;
				this.sliderElement.style.transform =`translateX(${nextOffset}px)`;
				this.fireChangeViewportEvent({ nextOffset, nextWidth });

				return;
			}

			if ((event.pageX - leftShiftX) <= wrapCoords.left) {
				const nextWidth = sliderCoords.right - wrapCoords.left;

				this.sliderElement.style.width = `${sliderCoords.right - wrapCoords.left}px`;
				this.sliderElement.style.transform =`translateX(0px)`;
				this.fireChangeViewportEvent({ nextOffset: 0, nextWidth });

				return;
			}

			this.sliderElement.style.width = `${newWidth}px`;
			this.sliderElement.style.transform =`translateX(${startX + delta}px)`;
			this.fireChangeViewportEvent({ nextOffset: startX + delta, nextWidth: newWidth});
		};

		function cleanUp() {
			document.removeEventListener(moveEvent, changeWidth);
			document.removeEventListener(upEvent, cleanUp);
		}

		document.addEventListener(moveEvent, changeWidth);
		document.addEventListener(upEvent, cleanUp);
	}
}

export default ChartMap;
