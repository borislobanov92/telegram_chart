
export type Rect = {
  top: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export default function getCoords(elem: HTMLElement): Rect {
	const  box = elem.getBoundingClientRect();

	return {
		top: box.top + pageYOffset,
		left: box.left + pageXOffset,
		right: box.right - pageXOffset,
		width: box.width,
		height: box.height,
	};
}
