import { useState } from 'react';
import { Action, ActionPanel, Form, Paper, setupTool } from '@macpaw/eney-api';
import z from 'zod';

export const props = z.object({
	date: z.date()
		.optional()
		.describe('The date to calculate the time until.'),
});

type Props = z.infer<typeof props>;

export default function HowLongUntil(props: Props) {
	const [date, setDate] = useState<Date>(props.date ?? new Date());
	const [result, setResult] = useState<string | undefined>(undefined);

	function onTimeChange(value: Date) {
		setDate(value);
	}

	function calculate() {
		const now = new Date();
		const delta = date.getTime() - now.getTime();

		// Check if both dates are on the same day
		const isSameDay = date.toDateString() === now.toDateString();

		if (isSameDay) {
			setResult('The selected date is today!');
			return;
		}

		const days = Math.floor(delta / (1000 * 60 * 60 * 24));
		const hours = Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((delta % (1000 * 60)) / 1000);

		setResult(`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`);
	}

	function onSubmit() {
		calculate();
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Calculate' onSubmit={onSubmit} style="secondary" />
					<Action.Finalize title="Done" />
				</ActionPanel>
      }
    >
      <Form.DatePicker label='Select date' name='date' type='datetime' value={date} onChange={onTimeChange} />
      {result && <Paper markdown={result} $context={true} />}
    </Form>
  );
}

setupTool(HowLongUntil);
