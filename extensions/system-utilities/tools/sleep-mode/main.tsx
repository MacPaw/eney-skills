import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Action, ActionPanel, Form, Paper } from '@macpaw/eney-api';
import { OPTIONS } from './options.ts';
import { Caffeinate } from './caffeinate.ts';
import { prettyTime } from './pretty-time.ts';

export const props = z.object({
	time: z.number()
		.optional()
		.describe('The time in seconds to keep macOS awake.'),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [options, setOptions] = useState(OPTIONS);
	const [initializing, setInitializing] = useState(true);
	const [time, setTime] = useState(options[0]);
	const [expire, setExpire] = useState(0);
	const [delta, setDelta] = useState(0);

	async function syncExistingProcess() {
		const pid = await Caffeinate.pid();
		if (!pid) {
			setExpire(0);
			setDelta(0);
			return;
		}
		const startTime = await Caffeinate.getStartTime(pid);
		const duration = await Caffeinate.getTimeArgument(pid);
		const expire = new Date(startTime.getTime() + duration * 1000).getTime();
		setExpire(expire);
		updateDelta(expire);
	}

	function onTimeChange(value: string) {
		setTime(Number(value));
	}

	async function onSubmit() {
		await Caffeinate.create(time);
		syncExistingProcess();
	}

	async function onTerminate() {
		await Caffeinate.terminate();
		syncExistingProcess();
	}

	function updateDelta(target: number) {
		const milliseconds = target - new Date().getTime();
		const seconds = Math.floor(milliseconds / 1000);
		setDelta(seconds);
	}

	useEffect(() => {
		(async () => {
			await syncExistingProcess();
			setInitializing(false);
		})();
	}, []);

	useEffect(() => {
		// add props time to options
		setOptions((options) => {
			if (!props.time) return OPTIONS;
			return [props.time, ...options];
		});
	}, [props.time]);

	useEffect(() => {
		setTime(options[0]);
	}, [options]);

	// check if process exists
	useEffect(() => {
		const timeout = setTimeout(async () => {
			const pid = await Caffeinate.pid();
			if (!pid) {
				clearTimeout(timeout);
				setDelta(0);
				setExpire(0);
				return;
			}
		}, 1000);
		return () => {
			clearTimeout(timeout);
		};
	});

	// countdown
	useEffect(() => {
		if (!expire) return;
		const interval = setInterval(() => {
			updateDelta(expire);
		}, 1000);
		return () => {
			clearInterval(interval);
		};
	}, [expire]);

	if (initializing) {
		// do not render to prevent UI blinking while initialization
		return null;
	}

	if (delta) {
		return (
			<Paper
				markdown={`macOS will not sleep for: ${prettyTime(delta)}`}
				actions={
					<ActionPanel>
						<Action title='Sleep as usual' onAction={onTerminate} />
					</ActionPanel>
				}
			/>
		);
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Stay Awake' onSubmit={onSubmit} />
				</ActionPanel>
			}
		>
			<Form.Dropdown label='Time to stay awake' name='time' value={String(time)} onChange={onTimeChange}>
				{options.map((option) => {
					return (
						<Form.Dropdown.Item
							key={option}
							value={String(option)}
							title={prettyTime(option)}
						/>
					);
				})}
			</Form.Dropdown>
		</Form>
	);
}
