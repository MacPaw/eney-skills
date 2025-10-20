import { useState } from 'react';
import { Action, ActionPanel, Form, Paper } from '@eney/api';
import { spawn } from 'node:child_process';

export default function Extension() {
	const [password, setPassword] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit() {
		setLoading(true);
		const networkName = await getNetworkName();
		const networkPassword = await getNetworkPassword(networkName);
		setPassword(networkPassword);
		setLoading(false);
	}

	async function getNetworkName() {
		const cmd = spawn('/bin/sh', ['-c', `system_profiler SPAirPortDataType | awk '/Current Network/ {getline;$1=$1; gsub(":",""); print; exit}'`]);
		const output = cmd.stdout.read();
		const stdout = new TextDecoder().decode(output).trim();
		return stdout;
	}

	async function getNetworkPassword(name: string) {
		const cmd = spawn('security', ['find-generic-password', '-wa', name]);
		const output = cmd.stdout.read();
		const stdout = new TextDecoder().decode(output).trim();
		return stdout;
	}

	if (password) {
		return <Paper markdown={password} />;
	}

	return (
		<Form>
			<ActionPanel>
				<Action.SubmitForm onSubmit={onSubmit} title='View WiFi password' style='primary' loading={loading} />
			</ActionPanel>
		</Form>
	);
}
