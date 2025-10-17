export function prettyTime(time: number) {
	const secondsInMinute = 60;
	const secondsInHour = 60 * secondsInMinute;
	const secondsInDay = 24 * secondsInHour;

	const days = Math.floor(time / secondsInDay);
	time %= secondsInDay;

	const hours = Math.floor(time / secondsInHour);
	time %= secondsInHour;

	const minutes = Math.floor(time / secondsInMinute);
	const seconds = time % secondsInMinute;

	let result = '';
	if (days) {
		result += ` ${days} ${days === 1 ? 'day' : 'days'}`;
	}
	if (hours) {
		result += ` ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
	}
	if (minutes) {
		result += ` ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
	}
	if (seconds) {
		result += ` ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
	}
	return result.trim();
}
