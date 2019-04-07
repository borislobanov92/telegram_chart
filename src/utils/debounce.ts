

export default function debounce(f: CallableFunction, ms: number): (...arg: any[]) => void {
	let timer: number = null;

	return function (...args: any[]) {
		const onComplete = () => {
			f(args);
			timer = null;
		};

		if (timer) {
			clearTimeout(timer);
		}

		timer = setTimeout(onComplete, ms);
	};
}
