import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class Caffeinate {
	static async pid() {
		try {
			const { stdout } = await execAsync('pgrep caffeinate');
			return Number(stdout.trim());
		} catch {
			// pgrep returns non-zero exit code when no process is found
			return 0;
		}
	}

	static async getStartTime(pid: number) {
		const { stdout } = await execAsync(`ps -p ${pid} -o lstart= -h`);
		return new Date(stdout.trim());
	}

	static async getTimeArgument(pid: number) {
		const { stdout } = await execAsync(`ps -p ${pid} -o args= -h`);

		const time = stdout.match(/-t\s+(\d+)/);
		if (!time) throw Error('unknown_arguments');
		return parseInt(time[1]);
	}

	static async create(time: number) {
		return new Promise<void>((resolve, reject) => {
			const child = spawn('bash', ['-c', `caffeinate -d -i -t ${String(time)} &`], {
				detached: true,
				stdio: 'ignore',
			});
			
			child.on('error', reject);
			child.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`Process exited with code ${code}`));
				}
			});
			
			child.unref();
		});
	}

	static async terminate() {
		return new Promise<void>((resolve, reject) => {
			const child = spawn('killall', ['caffeinate']);
			
			child.on('error', reject);
			child.on('close', (code) => {
				if (code === 0 || code === 1) {
					// Exit code 1 means no process found, which is fine
					resolve();
				} else {
					reject(new Error(`Process exited with code ${code}`));
				}
			});
		});
	}
}
