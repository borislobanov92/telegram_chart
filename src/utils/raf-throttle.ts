
export type ReturnTuple = [(...args: any[]) => any, () => number]

export default function rafThrottle<T extends unknown>(f: CallableFunction, time: number): ReturnTuple {
	let lastCallTime = performance.now();
	let lastArgs: any[];
	let lastResult: T;
	let isFirstCall = true;

	return [function () {
		var actualTime = performance.now();
		lastArgs = Array.from(arguments);

		if ((actualTime - lastCallTime) >= time || isFirstCall) {
			lastResult = f(lastArgs);
			lastCallTime = actualTime;
			isFirstCall = false;
		}

		return lastResult;
	}, () => lastCallTime = 0]
};
