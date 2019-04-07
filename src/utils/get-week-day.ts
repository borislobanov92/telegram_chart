export default function getWeekDay(ts: DOMTimeStamp) {
	const week_days_short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const date = new Date(ts);

	return week_days_short[date.getDay()];
};
