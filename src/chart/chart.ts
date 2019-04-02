import formatDate from '../utils/format-date.js';
import hexToRGB from '../utils/hex-to-rgb.js';
import rafThrottle from '../utils/raf-throttle.js';
import debounce from '../utils/debounce.js';
import clickOutside from '../utils/outside-click.js';
import ChartMap from '../chart-map/chart-map.js';
import ChartLegend from "../chart-legend/chart-legend.js";
import Tooltip from '../tooltip/tooltip.js';

const LABEL_OFFSET = 30;
const TOP_OFFSET = 40;
const HORIZONTAL_LINES = 5;
const VERTICAL_LINES = 3;
const DATE_COEF = 1.4;
const CHART_PADDING = 8;
const NIGHT_MODE_BG = '#242F3E';

const PRECISION = 5e-10;
const LABELS_PRECISION = 5e-3;

function calculateCanvasWidth (containerWidth, {start, end}) {
	return containerWidth / (end - start);
}

function getViewportOffset(canvasWidth, viewportStart) {
	return -(canvasWidth * viewportStart);
}

function getLowerBorder(minY, maxY, lowerBorder) {
	const dimension = (maxY - lowerBorder) / HORIZONTAL_LINES;
	const labels = new Array(HORIZONTAL_LINES + 1)
		.fill(0)
		.map((el, index) => dimension * index + lowerBorder);

	const firstHighLine = labels.findIndex((y) => y > minY);
	const lowerLine = labels[firstHighLine] - dimension;

	return lowerLine === lowerBorder
		? lowerBorder
		: Math.floor(getLowerBorder(minY, maxY, lowerLine))
}

class Chart {

	getTemplate(id = 0) {
		return `
			<section class="chart" id="chart-${id}">
				<div class="selected-tooltip"></div>

			 	<div class="chart__header">
        	Followers
      	</div>
				<div class="chart_canvas-wrap">
					<canvas
						class="chart__canvas canvas_for-datasets">
					</canvas>
					<canvas class="chart__canvas canvas_for-labels"></canvas>
					<iframe class="chart__resize-frame" src=""></iframe>
				</div>
				
				<div class="chart__map"></div>
				<div class="chart__legend chart-legend"></div>
				
			</section>
		`;
	}

	// Config shape

	// const config = {
	// 	timeline: data.columns[0].slice(1),
	// 	datasets: [
	// 		{
	// 			values: data.columns[1].slice(1),
	// 			id: 'y0',
	// 			color: '#3DC23F'
	// 		},
	// 		{
	// 			values: data.columns[2].slice(1),
	// 			id: 'y1',
	// 			color: '#F34C44'
	// 		}
	// 	]
	// };

	rootElement: Element;
    nightModeButton: Element;
	config: any;

	constructor({ rootElement, config, nightModeButton }) {
		this.rootElement = rootElement;
		this.config = config;
		this.nightModeButton = nightModeButton;
		this.timeline = this.config.timeline || [];
		this.datasets = null;

		this.datasetsCanvas = null;
		this.datasetsCtx = null;
		this.mapRootElement = null;
		this.map = null;
		this.legend = null;
		this.legendRootElement = null;
		this.tooltip = null;
		this.tooltipRootElement = null;

		this.canvasSize = null;
		this.devicePixelRatio = null;
		this.virtualWidth = null;
		this.offsetX = null;
		this.viewport = { start: 0.7, end: 1.0 };

		this.prevTs = null;
		this.delta = null;
		this.min = 0;
		this.max = 0;
		this.lowerBorder = 0;
		this.lastRatioY = null;
		this.ratioX = null;
		this.timelineDiff = this.timeline[this.timeline.length - 1] - this.timeline[0];
		this.lastLowerBorder = null;

		// Optimization flags
		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;
		this.isYLabelsAnimating = true;
		this.isXLabelsAnimating = true;
		this.rafId = null;
		this.selectedPointIndex = null;
		this.selectedPointX = null;
		this.isNightMode = false;

		this.resizeIframe = null;

		this.labelsY = {};
		this.labelsX = {};

		[this.getVerticalBorders, this.forceUpdateGVB] = rafThrottle(this.getVerticalBorders.bind(this), 250)
	}

	init() {
		this.rootElement.insertAdjacentHTML('beforeend', this.getTemplate());
		this.mapRootElement = this.rootElement.querySelector('.chart__map');
		this.legendRootElement = this.rootElement.querySelector('.chart__legend');
		this.tooltipRootElement = this.rootElement.querySelector('.selected-tooltip');

		this.datasetsCanvas = this.rootElement.querySelector('.canvas_for-datasets');
		this.labelsCanvas = this.rootElement.querySelector('.canvas_for-labels');
		this.resizeIframe = this.rootElement.querySelector('.chart__resize-frame');
		this.datasetsCtx = this.datasetsCanvas.getContext('2d');
		this.labelsCtx = this.labelsCanvas.getContext('2d');

		this.devicePixelRatio = window.devicePixelRatio || 1;
		this.updateSizes();

		this.datasets = this.config.datasets
			.map((dataset) => ({
					...dataset,
					opacity: 1,
					targetOpacity: 1,
				})
			);

		this.map = new ChartMap({
			rootElement: this.mapRootElement,
			config: { ...this.config, viewport: this.viewport },
			nightModeButton: this.nightModeButton,
		});
		this.map.init();

		this.legend = new ChartLegend(this.legendRootElement, this.config);
		this.legend.init();

		this.tooltip = new Tooltip(this.tooltipRootElement, this.datasetsCanvas);
		this.tooltip.init();

		this.addEventListeners();

		this.scheduleNextFrame();
		// this.rafId = requestAnimationFrame((ts) => this.startNextFrame(ts));
	}

	handleFrameResize() {
		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;

		this.map.updateSizes();
		this.updateSizes();
		this.updateTooltipPosition();

		// if we already has working loop we should not run another one
		this.scheduleNextFrame();
	}

	updateTooltipPosition() {
		if (this.selectedPointIndex !== null) {
			this.selectedPointX = (this.timeline[this.selectedPointIndex] - this.timeline[0]) * this.ratioX;

			const tooltipX = this.getAbsoluteXCoordinate(this.selectedPointX, this.offsetX);
			const pointValues = this.datasets.map(d => d.values[this.selectedPointIndex] * this.lastRatioY);

			this.tooltip.updateTooltipPosition({
				xCoord: tooltipX - CHART_PADDING,
				canvasWidth: this.canvasSize.width,
				canvasHeight: this.canvasSize.height,
				pointValues,
			});
			this.shouldRerenderDatasets = true;
		}
	}

	updateSizes() {
		this.canvasSize = this.datasetsCanvas.getBoundingClientRect();

		this.datasetsCanvas.width = this.canvasSize.width * this.devicePixelRatio;
		this.datasetsCanvas.height = this.canvasSize.height * this.devicePixelRatio;
		this.labelsCanvas.width = this.canvasSize.width * this.devicePixelRatio;
		this.labelsCanvas.height = this.canvasSize.height * this.devicePixelRatio;

		this.virtualWidth = calculateCanvasWidth(this.canvasSize.width, this.viewport);
		this.offsetX = getViewportOffset(this.virtualWidth, this.viewport.start);
		this.ratioX = this.virtualWidth / this.timelineDiff;
	}

	changeViewport(nextViewport) {
		this.viewport.start = nextViewport.start;
		this.viewport.end = nextViewport.end;
		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;

		// if we already has working loop we should not run another one
		this.scheduleNextFrame();
	}

	toggleActiveDatasets({ id, checked }) {
		for(let i = 0; i < this.datasets.length; i++) {
			if (this.datasets[i].id === id) {
				this.datasets[i].targetOpacity = checked ? 1 : 0;
				this.map.toggleDataset({ id, checked });
			}
		}

		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;
		this.forceUpdateGVB();

		// if we already has working loop we should not run another one
		this.scheduleNextFrame()
	}

	scheduleNextFrame() {
		if (!this.rafId) {
			this.rafId = requestAnimationFrame((ts) => this.startNextFrame(ts));
		}
	}

	startNextFrame(ts) {
		// Experimental optimization
		if (!this.shouldRerenderDatasets && !this.shouldRerenderLabels) {
			// Maybe we don't need this line
			cancelAnimationFrame(this.rafId);
			this.rafId = null;

			return;
		}

		this.rafId = requestAnimationFrame((ts) => this.startNextFrame(ts));
		this.update(ts);
	}

	// Just for init force get vertical borders method
	forceUpdateGVB() {};

	update(ts) {
		const prevTs = this.prevTs || ts;
		// update prev timestamp
		this.delta = Math.min(25, ts - prevTs);
		this.virtualWidth = calculateCanvasWidth(this.canvasSize.width, this.viewport);
		this.offsetX = getViewportOffset(this.virtualWidth, this.viewport.start);
		this.prevTs = ts;

		const end = Math.round(this.viewport.end * 100) / 100;
		const start = Math.round(this.viewport.start * 100) / 100;
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		const startTimestamp = this.timeline[0] + Math.floor(start * this.timelineDiff);
		const dueTimestamp = this.timeline[0] + Math.floor(end * this.timelineDiff);

		const k = 0.008 * this.delta;
		let activeDatasets = [];
		let shouldRerenderDatasets = false;
		let isLowerBorderChanging = false;
		let isRatioYChanging = false;

		for(let i = 0; i < this.datasets.length; i++) {
			const diff = this.datasets[i].targetOpacity - this.datasets[i].opacity;

			this.datasets[i].opacity = Math.abs(diff) < PRECISION
				? this.datasets[i].targetOpacity
				: this.datasets[i].opacity + k * diff;

			shouldRerenderDatasets = !Math.abs(diff) < PRECISION || shouldRerenderDatasets;

			if (this.datasets[i].targetOpacity === 1) {
				activeDatasets.push(this.datasets[i]);
			}
		}

		[this.min, this.max] = this.getVerticalBorders(activeDatasets, startTimestamp, dueTimestamp);
		this.lowerBorder = activeDatasets.length > 0
			? getLowerBorder(this.min, this.max, 0)
			: this.lowerBorder;
		const ratioY = (chartHeight - 10) / (this.max - this.lowerBorder);
		this.ratioX = this.virtualWidth / this.timelineDiff;

		// Spring lower border
		if (this.lastLowerBorder != null) {
			const diff = this.lowerBorder - this.lastLowerBorder;

			this.lastLowerBorder = Math.abs(diff) < PRECISION
				? this.lowerBorder
				: this.lastLowerBorder + k * diff;
			isLowerBorderChanging = !Math.abs(diff) < PRECISION;

		} else {
			this.lastLowerBorder = this.lowerBorder;
		}

		// Spring ratioY
		if (this.lastRatioY != null) {
			const diff = ratioY - this.lastRatioY;

			this.lastRatioY = Math.abs(diff) < PRECISION
				? ratioY
				: this.lastRatioY + k * diff;

			isRatioYChanging = !Math.abs(diff) < PRECISION;
		} else {
			this.lastRatioY = ratioY;
		}

		if (this.shouldRerenderLabels || isLowerBorderChanging || isRatioYChanging) {
			this.labelsCtx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, this.offsetX * this.devicePixelRatio, 0);
			this.labelsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);

			this.drawGrid(ratioY, this.ratioX, this.lowerBorder);

			this.selectedPointX = (this.timeline[this.selectedPointIndex] - this.timeline[0]) * this.ratioX;
			this.drawSelectedVerticalLine();

			for (let i = 0; i < this.datasets.length; i++) {
				if (+this.datasets[i].opacity.toFixed(2) > 0) {

					if (this.selectedPointIndex !== null && this.datasets[i].targetOpacity !== 0) {
						this.drawSelectedPoint(
							this.selectedPointX,
							this.getRelativeY(
								chartHeight,
								this.datasets[i].values[this.selectedPointIndex],
								this.lastRatioY
							),
							this.datasets[i].color
						);
					}
				}
			}

		}

		if (this.shouldRerenderDatasets || shouldRerenderDatasets || isRatioYChanging || isLowerBorderChanging) {
			this.datasetsCtx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, this.offsetX * this.devicePixelRatio, 0);
			this.datasetsCtx.clearRect(0, 0, this.virtualWidth, this.canvasSize.height);

			for (let i = 0; i < this.datasets.length; i++) {
				if (+this.datasets[i].opacity.toFixed(2) > 0) {
					this.drawChart(this.datasets[i], this.lastRatioY, this.ratioX);
				}
			}

		}

		this.shouldRerenderLabels = this.isXLabelsAnimating || this.isYLabelsAnimating;
		this.shouldRerenderDatasets = shouldRerenderDatasets || isRatioYChanging || isLowerBorderChanging;

		// Update springs at chart map
		this.map.update(ts);
	}

	drawGrid(ratioY, ratioX, lowerBorder) {
		this.drawXLabels(ratioX);
		this.drawYLabels(ratioY, lowerBorder);
	}

	drawChart(dataset, ratioY, ratioX) {
		const { color, opacity } = dataset;
		const updatedColor = hexToRGB(color, opacity);
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		let y = chartHeight - (dataset.values[0] - this.lastLowerBorder) * ratioY;

		this.datasetsCtx.save();

		this.datasetsCtx.lineWidth = 2.0;
		this.datasetsCtx.lineJoin = 'round';
		this.datasetsCtx.beginPath();
		this.datasetsCtx.moveTo(0, y);
		this.datasetsCtx.strokeStyle = updatedColor;

		for(let i = 0; i < dataset.values.length; i++) {
			y = chartHeight - (dataset.values[i] - this.lastLowerBorder) * ratioY;

			this.datasetsCtx.lineTo((this.timeline[i] - this.timeline[0]) * ratioX, y);
		}

		this.datasetsCtx.stroke();
		this.datasetsCtx.restore();
	}

	drawYLabels(ratioY, lowerBorder) {
		const chartHeight = this.canvasSize.height - LABEL_OFFSET;
		const offsetX = -1 * this.offsetX;
		const newMaxY = (chartHeight - TOP_OFFSET) / ratioY;
		const dimension = newMaxY / HORIZONTAL_LINES;
		const newLabelsY = new Array(6)
			.fill(0)
			.map((el, index) => ({
					targetOpacity: 0.4,
					opacity: 0,
					targetStrokeOpacity: 0.08,
					strokeOpacity: 0,
					currentValue: Math.floor((dimension * index + lowerBorder) * 1000) / 1000,
				})
			);

		const p = 0.005 * this.delta;

		for (let key in this.labelsY) {
			this.labelsY[key].targetOpacity = 0;
			this.labelsY[key].targetStrokeOpacity = 0;

			if (+this.labelsY[key].opacity.toFixed(2) === 0) {
				delete this.labelsY[key];
			}
		}

		for (let i = 0; i < newLabelsY.length; i++) {
			const label = this.labelsY[newLabelsY[i].currentValue];

			if (label) {
				label.targetOpacity = 0.4;
				label.targetStrokeOpacity = 0.08;
			} else {
				this.labelsY[newLabelsY[i].currentValue] = newLabelsY[i];
			}
		}

		this.labelsCtx.save();

		this.labelsCtx.lineWidth = 1;
		this.labelsCtx.font = `13px Arial`;
		this.labelsCtx.fillStyle = this.isNightMode
			? hexToRGB('#bacde073', 0.4)
			: hexToRGB('#000000', 0.4);

		let isLabelsAnimating = false;

		for (let key in this.labelsY) {
			const label = this.labelsY[key];
			const y = chartHeight - (this.lastRatioY * label.currentValue) + (this.lastLowerBorder * this.lastRatioY);
			const opacityDiff = label.targetOpacity - label.opacity;
			const strokeOpacityDiff = label.targetStrokeOpacity - label.strokeOpacity;

			label.opacity = Math.abs(opacityDiff) < LABELS_PRECISION
				? label.targetOpacity
				: label.opacity + p * opacityDiff;

			label.strokeOpacity = Math.abs(strokeOpacityDiff) < LABELS_PRECISION
				? label.targetStrokeOpacity
				: label.strokeOpacity + p * strokeOpacityDiff;

			isLabelsAnimating = !Math.abs(opacityDiff) < LABELS_PRECISION || !Math.abs(strokeOpacityDiff) < LABELS_PRECISION || isLabelsAnimating;

			this.labelsCtx.save();

			this.labelsCtx.beginPath();
			this.labelsCtx.moveTo(0, +y.toPrecision(4));
			this.labelsCtx.lineTo(this.virtualWidth, +y.toPrecision(4));
			this.labelsCtx.fillStyle = this.isNightMode
				? hexToRGB('#bacde073', label.opacity.toPrecision(3))
				: hexToRGB('#000000', label.opacity.toPrecision(3));
			this.labelsCtx.strokeStyle = this.isNightMode
				? hexToRGB('#bacde073', label.strokeOpacity)
				: hexToRGB('#000000', label.strokeOpacity);
			this.labelsCtx.fillText(Math.floor(label.currentValue).toString(), offsetX + 10, y - 6);
			this.labelsCtx.stroke();

			this.labelsCtx.restore();
		}

		this.labelsCtx.restore();
		this.isYLabelsAnimating = isLabelsAnimating;
	}

	drawXLabels(ratioX) {
		const initStep = this.timelineDiff / VERTICAL_LINES;
		const newLabelsX = [];
		const p = 0.005 * this.delta;
		let step = initStep;
		let nextLabelDate = this.timeline[0];

		while (step > initStep * DATE_COEF * (this.viewport.end - this.viewport.start)) {
			step = step / 2;
		}

		while (nextLabelDate < this.timeline[this.timeline.length - 1]) {
			const offset = nextLabelDate === this.timeline[0]
				? 0
				: -0.5;

			newLabelsX.push({
				text: formatDate(nextLabelDate),
				date: nextLabelDate,
				offset: offset,
				targetOpacity: 0.4,
				opacity: 0,
			});

			nextLabelDate += step;
		}

		// Add last label
		newLabelsX.push({
			text: formatDate(this.timeline[this.timeline.length - 1]),
			offset: -1,
			date: this.timeline[this.timeline.length - 1],
			targetOpacity: 0.4,
			opacity: 0,
		});

		for (let key in this.labelsX) {
			this.labelsX[key].targetOpacity = 0;

			if (+this.labelsX[key].opacity.toFixed(2) === 0) {
				delete this.labelsX[key];
			}
		}

		for(let i = 0; i < newLabelsX.length; i++) {
			const label = newLabelsX[i];

			if (this.labelsX[label.text]) {
				this.labelsX[label.text].targetOpacity = 0.4;
			} else {
				this.labelsX[label.text] = label;
			}
		}

		this.labelsCtx.save();

		this.labelsCtx.font = `13px Arial`;
		this.labelsCtx.fillStyle = this.isNightMode
			? hexToRGB('#bacde073', 0.4)
			: hexToRGB('#000000', 0.4);

		let isLabelsAnimating = false;

		for(let key in this.labelsX) {
			const label = this.labelsX[key];
			const diff = label.targetOpacity - label.opacity;
			const x = (label.date - this.timeline[0]) * ratioX + label.offset * this.labelsCtx.measureText(label.text).width;

			label.opacity = Math.abs(diff) < LABELS_PRECISION
				? label.targetOpacity
				: label.opacity + p * diff;

			isLabelsAnimating = !Math.abs(diff) < LABELS_PRECISION || isLabelsAnimating;
			this.labelsCtx.save();

			this.labelsCtx.beginPath();
			this.labelsCtx.moveTo(label.x, this.canvasSize.height);

			this.labelsCtx.fillStyle = this.isNightMode
				? hexToRGB('#bacde073', label.opacity.toPrecision(3))
				: hexToRGB('#000000', label.opacity.toPrecision(3));
			this.labelsCtx.fillText(label.text, x, this.canvasSize.height - 10);
			this.labelsCtx.restore();
		}

		this.labelsCtx.restore();
		this.isXLabelsAnimating = isLabelsAnimating;
	}

	getRelativeY(chartHeight, value, ratioY) {
		return chartHeight - (value - this.lastLowerBorder) * ratioY;
	}

	drawSelectedVerticalLine() {
		this.labelsCtx.lineWidth = 2;
		this.labelsCtx.strokeStyle = this.isNightMode
			? hexToRGB('#bacde073', 0.08)
			: hexToRGB('#000000', 0.08);
		this.labelsCtx.beginPath();
		this.labelsCtx.moveTo(this.selectedPointX, 0);
		this.labelsCtx.lineTo(this.selectedPointX, this.canvasSize.height - LABEL_OFFSET);
		this.labelsCtx.stroke();
	}

	drawSelectedPoint(x, y, color) {
		const r = 4.0;

		this.labelsCtx.save();

		this.labelsCtx.beginPath();
		this.labelsCtx.strokeStyle = color;
		this.labelsCtx.lineWidth = 4.0;
		this.labelsCtx.fillStyle = this.isNightMode
			? NIGHT_MODE_BG
			: '#fff';
		this.labelsCtx.arc(x, y, r, 0, Math.PI * 2);
		this.labelsCtx.stroke();
		this.labelsCtx.fill();
		this.labelsCtx.restore();
	}

	getVerticalBorders(datasets, startDate, dueDate) {
		let minValue = Infinity;
		let maxValue = -Infinity;

		if (datasets.length === 0) {
			return [this.min, this.max];
		}

		for(let i = 0; i < datasets.length; i++) {
			const values = datasets[i].values;

			for(let j = 0; j < values.length; j++) {
				if (this.timeline[j] >= startDate && this.timeline[j] <= dueDate) {
					minValue = Math.min(minValue, values[j]);
					maxValue = Math.max(maxValue, values[j]);
				}
			}
		}

		return [Math.floor(minValue * 0.99 * 1000) / 1000, Math.floor(maxValue * 1.01 * 1000) / 1000];
	}

	addEventListeners() {
		this.labelsCanvas.addEventListener('touchstart', event => this.showTooltip(event.touches[0].clientX));
		this.labelsCanvas.addEventListener('touchmove', event => this.showTooltip(event.touches[0].clientX));
		this.labelsCanvas.addEventListener('mousedown', event => this.showTooltip(event.offsetX + CHART_PADDING));

		const nightModeButton = this.nightModeButton.element;

		clickOutside(this.rootElement, 'click', (e) => {
			if (!nightModeButton.contains(event.target) && nightModeButton !== event.target) {
				this.closeTooltip();
			}
		});
		clickOutside(this.rootElement, 'touchstart', (e) => {
			if (!nightModeButton.contains(event.target) && nightModeButton !== event.target) {
				this.closeTooltip()
			}
		});

		this.legend.subscribe((event) => this.handleLegendChange(event));
		this.map.subscribe((nextViewport) => this.handleViewportChange(nextViewport));
		this.nightModeButton.subscribe(isNightMode => this.handleThemeChange(isNightMode));

		this.resizeIframe.contentWindow
			.addEventListener('resize', debounce(() => this.handleFrameResize(), 100).bind(this));
	};

	handleThemeChange(isNightMode) {

		this.isNightMode = isNightMode;
		let chartHeaderColor;
		let tooltipBg;
		let tooltipBorder;
		let tooltipHeader;

		if (this.isNightMode) {
			chartHeaderColor = '#fff';
			tooltipBg = NIGHT_MODE_BG;
			tooltipBorder = NIGHT_MODE_BG;
			tooltipHeader = '#fff';
		} else {
			chartHeaderColor = '#000';
			tooltipBg = '#fff';
			tooltipBorder = '#eee';
			tooltipHeader = '#000';
		}

		this.shouldRerenderDatasets = true;
		this.rootElement.querySelector('.chart__header').style.color = chartHeaderColor;
		this.tooltipRootElement.style.backgroundColor = tooltipBg;
		this.tooltipRootElement.style.borderColor = tooltipBorder;
		this.tooltipRootElement.querySelector('.selected-tooltip__header').style.color = tooltipHeader;

		this.legendRootElement.classList.toggle('chart__legend--night-mode');

		this.shouldRerenderDatasets = true;
		this.shouldRerenderLabels = true;

		this.scheduleNextFrame();
	}

	handleViewportChange(nextViewport) {
		this.updateTooltipPosition();
		this.changeViewport(nextViewport);
	}

	handleLegendChange(event) {
		this.toggleActiveDatasets(event);

		const idx = this.selectedPointIndex;
		const datasets = this.datasets.filter(d => d.targetOpacity !== 0);

		if (datasets.length > 0 ) {
			this.tooltip.updateTooltipData(this.timeline[idx], this.getSelectedPointsData(datasets, idx));
		} else {
			this.closeTooltip();
		}
	}

	showTooltip(x) {
		const virtualX = this.getRelativeXCoordinate(x - pageXOffset, this.offsetX);
		const i = Math.round(virtualX * (this.timeline.length - 1) / this.virtualWidth);
		const idx = Math.max(0, Math.min(this.timeline.length - 1, i));
		const pointsData = this.getSelectedPointsData(this.getRenderedDatasets(), idx);

		this.selectedPointIndex = idx;
		this.selectedPointX = (this.timeline[idx] - this.timeline[0]) * this.ratioX;
		this.tooltip.updateTooltipData(this.timeline[idx], pointsData);

		this.shouldRerenderLabels = true;

		this.updateTooltipPosition();
		this.scheduleNextFrame();
	}

	closeTooltip() {
		this.selectedPointIndex = null;
		this.selectedPointX = null;
		this.tooltip.hide();

		this.shouldRerenderLabels = true;
		this.scheduleNextFrame();
	}

	getRenderedDatasets() {
		return this.datasets.filter(dataset => +dataset.opacity.toFixed(2) > 0);
	}

	getSelectedPointsData(datasets, idx) {
		return datasets.map(dataset => {
			return {
				color: dataset.color,
				value: dataset.values[idx],
				chartName: this.config.names[Object.keys(this.config.names).find(key => key === dataset.id)],
			}
		});
	}

	getRelativeXCoordinate(xCoord, offsetX) {
		return xCoord - offsetX - CHART_PADDING;
	}

	getAbsoluteXCoordinate(xCoord, offsetX) {
		return xCoord + offsetX + CHART_PADDING;
	}
}

export default Chart;
