import getWeekDay from '../utils/get-week-day';
import formatDate from '../utils/format-date';


class Tooltip {
    static getTooltipTemplate() {
        return `
            <div class="selected-tooltip__header"></div>
            <div class="selected-tooltip__label-container"></div>
		`;
    }

    constructor(private element: HTMLElement) {}

    init() {
        this.element.insertAdjacentHTML('beforeend', Tooltip.getTooltipTemplate());
    }

    updateTooltipData(date: DOMTimeStamp, pointsData) {
        const header = this.element.querySelector('.selected-tooltip__header');
        const labelContainer = this.element.querySelector('.selected-tooltip__label-container');

        labelContainer.innerHTML = '';
        header.textContent = `${getWeekDay(date)}, ${formatDate(date)}`;
        this.element.style.display = 'block';

        pointsData.forEach(({color, value, chartName}) => {
            const labelEl = document.createElement('div');
            const valueEl = document.createElement('span');
            const chartNameEl = document.createElement('span');

            labelEl.classList.add('selected-tooltip__label');
            labelEl.style.color = color;
            valueEl.classList.add('selected-tooltip__value');
            valueEl.textContent = value;
            chartNameEl.classList.add('selected-tooltip__chart-name');
            chartNameEl.textContent = chartName;

            labelEl.appendChild(valueEl);
            labelEl.appendChild(chartNameEl);
            labelContainer.appendChild(labelEl);
        });
    }

    updateTooltipPosition({ xCoord, canvasWidth, pointValues, canvasHeight }) {
        let tooltipLeftMargin = -24;
        const translateY = 40;

        if (Math.floor(xCoord) > canvasWidth || Math.ceil(xCoord) < 0) {
            this.element.style.visibility = 'hidden';
            return;
        }

        const width = this.element.getBoundingClientRect().width;

        if (this.isOverDataPoint(pointValues, canvasHeight, translateY)) {
            if (xCoord + width > canvasWidth) {
                tooltipLeftMargin = -16 - width;
            } else {
                tooltipLeftMargin = 16;
            }
        }

        let translateX;

        if (xCoord + width + tooltipLeftMargin > canvasWidth) {
            translateX = canvasWidth - width;
        } else if (width === 0) {
            translateX = canvasWidth;
        } else if (xCoord + tooltipLeftMargin < 0) {
            translateX = 0;
        } else {
            translateX = xCoord + tooltipLeftMargin;
        }

        this.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`;
        this.element.style.visibility = 'visible';
    }

    isOverDataPoint(pointValues, canvasHeight, offsetTop) {
        const top = canvasHeight - offsetTop;
        const bottom = top - this.element.getBoundingClientRect().height;

        for (let i = 0; i < pointValues.length; i++) {
            if (pointValues[i] > bottom) {
                return true;
            }
        }

        return false;
    }

	hide() {
		this.element.style.visibility = 'hidden';
	}
}

export default Tooltip;
