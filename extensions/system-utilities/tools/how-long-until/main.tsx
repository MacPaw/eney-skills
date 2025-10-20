import { useEffect, useState } from 'react';
import { Action, ActionPanel, Form, Paper } from '@eney/api';
import z from 'zod';

export const props = z.object({
	date: z.date()
		.optional()
		.describe('The date to calculate the time until.'),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [isRunning, setIsRunning] = useState(false);
	const [date, setDate] = useState<Date>(props.date ?? new Date());
	const [result, setResult] = useState<string | undefined>(undefined);

	function onTimeChange(value: Date) {
		setDate(value);
	}

	useEffect(() => {
		if (!isRunning) return;

		const interval = setInterval(() => {
			calculate();
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [isRunning]);

	function calculate() {
		const now = new Date();
		const delta = date.getTime() - now.getTime();

		// Check if both dates are on the same day
		const isSameDay = date.toDateString() === now.toDateString();

		if (isSameDay) {
			setIsRunning(false);
			setResult('The selected date is today!');
			return;
		}

		const days = Math.floor(delta / (1000 * 60 * 60 * 24));
		const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((delta % (1000 * 60)) / 1000);

		setIsRunning(true);
		setResult(`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`);
	}

	function onSubmit() {
		// clear previous state
		setIsRunning(false);
		setResult(undefined);

		setTimeout(() => {
			calculate();
		}, 100);
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Calculate' onSubmit={onSubmit} />
				</ActionPanel>
			}
		>
			<Form.DatePicker label='Select date' name='date' type='datetime' value={date} onChange={onTimeChange} />
			{result && <Paper markdown={result} />}
		</Form>
	);
}
