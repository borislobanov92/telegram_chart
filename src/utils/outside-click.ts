export default function clickOutside(element: HTMLElement, eventName: string, callback: EventListener) {

	const outsideClickListener = (event: Event) => {
		if (!element.contains(event.target as Node) && element !== event.target) {
			callback(event);
		}
	};

	document.addEventListener(eventName, outsideClickListener)
}
