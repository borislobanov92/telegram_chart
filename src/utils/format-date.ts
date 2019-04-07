
export default function formatDate(ts: DOMTimeStamp): string {
	const date = new Date(ts);
	const month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const number = date.getDate() > 9 ? date.getDate() : `0${date.getDate()}`;
	return `${month_names_short[date.getMonth()]} ${number}`;
};
