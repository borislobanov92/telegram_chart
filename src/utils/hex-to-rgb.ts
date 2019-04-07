
// Transform hex string of color to RGB format

export default function hexToRGB(hex: string, alpha: number = 1): string {
	const red = parseInt(hex.slice(1, 3), 16);
	const green = parseInt(hex.slice(3, 5), 16);
	const blue = parseInt(hex.slice(5, 7), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
