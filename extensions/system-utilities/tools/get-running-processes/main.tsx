import { useCallback, useEffect, useState } from 'react';
import { Action, ActionPanel, Paper } from '@macpaw/eney-api';
import { spawn } from 'node:child_process';

interface ProcessInfo {
	pid: string;
	cpu: number;
	memoryMb: number;
	command: string;
}

function escapeMarkdown(text: string): string {
	// First escape backslashes, then escape pipes
	return text.replace(/\\/g, '\\\\').replace(/[|]/g, '\\$&');
}

function formatProcesses(raw: string): ProcessInfo[] {
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [pid, cpu, rss, ...commandParts] = line.split(/\s+/);
			const command = commandParts.join(' ');
			const cpuValue = Number.parseFloat(cpu ?? '0');
			const rssValue = Number.parseInt(rss ?? '0', 10);
			return {
				pid,
				cpu: Number.isFinite(cpuValue) ? cpuValue : 0,
				memoryMb: Number.isFinite(rssValue) ? rssValue / 1024 : 0,
				command: command || '[unknown]'
			};
		})
		.filter((process) => Boolean(process.pid) && Number.isFinite(process.cpu));
}

async function fetchProcesses(): Promise<ProcessInfo[]> {
	const ps = spawn('ps', ['-axo', 'pid=,pcpu=,rss=,command=', '-r']);
	return await new Promise((resolve, reject) => {
		let stdout = '';
		let stderr = '';

		ps.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		ps.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		ps.on('error', (error) => {
			reject(error);
		});

		ps.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(stderr.trim() || `ps exited with code ${code}`));
				return;
			}
			const processes = formatProcesses(stdout)
				.sort((a, b) => b.cpu - a.cpu)
				.slice(0, 10);
			resolve(processes);
		});
	});
}

export default function Extension() {
	const [processes, setProcesses] = useState<ProcessInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadProcesses = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await fetchProcesses();
			setProcesses(list);
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError('Failed to load running processes.');
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadProcesses();
	}, [loadProcesses]);

	const actions = (
		<ActionPanel>
			<Action title='Refresh' onAction={loadProcesses} style='primary' loading={loading} />
		</ActionPanel>
	);

	if (error) {
		return (
			<Paper
				markdown={`**Error:** ${error}`}
				actions={actions}
			/>
		);
	}

	const markdown = processes.length
		? [
				'| PID | CPU % | RSS MB | Command |',
				'| --- | ---: | ---: | --- |',
				...processes.map((process) => {
					const cpu = process.cpu.toFixed(1);
					const memory = process.memoryMb.toFixed(1);
					return `| ${process.pid} | ${cpu} | ${memory} | ${escapeMarkdown(process.command)} |`;
				})
		  ].join('\n')
		: 'No running processes found.';

	return (
		<Paper
			markdown={loading && !processes.length ? 'Loading processes…' : markdown}
			actions={actions}
		/>
	);
}
