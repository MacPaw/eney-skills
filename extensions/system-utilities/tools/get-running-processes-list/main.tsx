import { useCallback, useEffect, useState } from 'react';
import { Action, ActionPanel, Paper, setupTool } from '@macpaw/eney-api';
import { spawn } from 'node:child_process';

interface ProcessInfo {
	cpu: number;
	memoryMb: number;
	command: string;
}

function escapeMarkdown(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/[|]/g, '\\$&');
}

function getShortProcessName(fullCommand: string): string {
	const execPath = fullCommand.split(/\s+-/)[0].trim();
	const name = execPath.split('/').pop() || execPath;
	return name || '[unknown]';
}

function formatProcesses(raw: string): ProcessInfo[] {
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [cpu, rss, ...commandParts] = line.split(/\s+/);
			const fullCommand = commandParts.join(' ');
			const cpuValue = Number.parseFloat(cpu ?? '0');
			const rssKb = Number.parseInt(rss ?? '0', 10);
			return {
				cpu: Number.isFinite(cpuValue) ? cpuValue : 0,
				memoryMb: Number.isFinite(rssKb) ? rssKb / 1024 : 0,
				command: getShortProcessName(fullCommand)
			};
		})
		.filter((process) => Number.isFinite(process.cpu));
}

async function fetchProcesses(): Promise<ProcessInfo[]> {
	const ps = spawn('ps', ['-axo', 'pcpu=,rss=,command=', '-r']);
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

export default function GetRunningProcessesList() {
	const [processes, setProcesses] = useState<ProcessInfo[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadProcesses = useCallback(async () => {
		setIsLoading(true);
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
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadProcesses();
	}, [loadProcesses]);

	const actions = (
		<ActionPanel layout="row">
			<Action title='Refresh' onAction={loadProcesses} style="secondary" isLoading={isLoading} />
			<Action.Finalize title="Done" />
		</ActionPanel>
	);

	if (error) {
		return (
			<Paper
				markdown={`**Error:** ${error}`}
				actions={actions}
				$context={true}
			/>
		);
	}

	const markdown = processes.length
		? [
				'| CPU % | Memory (MB) | Process |',
				'| ---: | ---: | --- |',
				...processes.map((process) => {
					const cpu = process.cpu.toFixed(1);
					const memory = process.memoryMb.toFixed(1);
					return `| ${cpu} | ${memory} | ${escapeMarkdown(process.command)} |`;
				})
		  ].join('\n')
		: 'No running processes found.';

	return (
		<Paper
			markdown={isLoading && !processes.length ? 'Loading processes…' : markdown}
			actions={actions}
			isScrollable
			$context={true}
		/>
	);
}

setupTool(GetRunningProcessesList);
