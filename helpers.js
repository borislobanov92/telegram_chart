export const getDimension = (maxPoint, horizontalLines) => {
    return maxPoint / horizontalLines;
};

export const getZoomRatio = (chartHeight, maxPoint) => {
    return chartHeight / maxPoint;
};

export const getViewportX = (canvasWidth, viewportStart) => {
    return -(canvasWidth * viewportStart);
};

export const getLabelWidth = (text, fontSize) => {
    // TODO: check this function
    return Math.ceil(text.length * fontSize / 2);
};

export const formatDate = (ts) => {
    // TODO: refactor this (toLocaleString?)
    const date = new Date(ts);
    const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const number = date.getDate() > 9 ? date.getDate() : `0${date.getDate()}`;
    return `${month_names_short[date.getMonth()]} ${number}`;
};

export const calculateCanvasWidth = (containerWidth, {start, end}) => {
    return containerWidth / (end - start);
};

export const scrollToViewport = (canvas, containerWidth, {start, end}) => {
    canvas.width = calculateCanvasWidth(containerWidth, {start, end});
    canvas.style.transform = `translateX(${getViewportX(canvas.width, start)}px)`;
};

export const rafThrottle = function t(f, time) {
    var lastCallTime = performance.now();
    var lastArgs;
    var lastResult;
    var isFirst = true;

    return [function () {
        var actualTime = performance.now();
        lastArgs = arguments;

        if ((actualTime - lastCallTime) >= time || isFirst) {
            lastResult = f.apply(this, lastArgs);
            lastCallTime = actualTime;
            isFirst = false;
        }


        return lastResult;
    }, () => lastCallTime = 0]
}


export function hexToRGB(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    } else {
        return "rgb(" + r + ", " + g + ", " + b + ")";
    }
}
