import { stat } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { isKebabCase } from './utils.ts';
import { join } from 'node:path';

export async function askMcpId(): Promise<string> {
	const value = await p.text({
		message: 'What is the id of the MCP server?',
		placeholder: 'security-utilities-mcp',
		validate: (value) => {
			if (!value) {
				return 'MCP server id is required';
			}

			if (!isKebabCase(value)) {
				return 'MCP server id must be in kebab case, example: security-utilities-mcp';
			}
		},
	});

	if (p.isCancel(value)) {
		p.cancel('Operation cancelled.');
		process.exit(0);
	}

	return value;
}

export async function getFolderAction(outputFolder: string): Promise<'overwrite' | 'cancel' | 'create'> {
	const isCI = process.env.CI === 'true';

	try {
		await stat(outputFolder);

		if (isCI) {
			console.log(`MCP server at "${outputFolder}" already exists, overwriting in CI mode`);
			return 'overwrite';
		}

		p.log.warn(`MCP server at "${outputFolder}" already exists`);

		const shouldOverwrite = await p.confirm({
			message: 'Do you want to overwrite the MCP server?',
			initialValue: false,
		});

		if (p.isCancel(shouldOverwrite)) {
			return 'cancel';
		}

		return shouldOverwrite ? 'overwrite' : 'cancel';
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return 'create';
		}

		throw error;
	}
}

export type McpDetails = {
	mcpId: string;
	mcpTitle: string;
	toolName: string;
	toolDescription: string;
	toolTitle: string;
};

export async function askOutputDirectory(): Promise<string> {
	const initialDirectory = join(process.cwd(), "mcps");

	const value = await p.text({
		message: 'Where do you want to create the MCP server? (absolute path)',
		initialValue: initialDirectory,
		validate: (value) => {
			if (!value) {
				return 'Output directory is required';
			}

			try {
				stat(value).then((s) => {
					if (!s.isDirectory()) {
						return 'Output path must be a directory';
					}
				});
			} catch (error) {
				return 'Output directory does not exist';
			}
		},
	});

	if (p.isCancel(value)) {
		p.cancel('Operation cancelled.');
		process.exit(0);
	}

	return value;
}

export async function askMcpDetails(): Promise<Omit<McpDetails, 'mcpId'>> {
	const answers = await p.group(
		{
			mcpTitle: () =>
				p.text({
					message: 'What is the title of the MCP server?',
					placeholder: 'Security Utilities',
					validate: (value) => {
						if (!value) return 'MCP server title is required';
					},
				}),
			toolName: () =>
				p.text({
					message: 'What is the name of the tool? It will be used as name of component file.',
					placeholder: 'new-password',
					validate: (value) => {
						if (!value) return 'Tool name is required';
					},
				}),
			toolDescription: () =>
				p.text({
					message: 'What is the description of the tool? It will be used for LLM to select the tool.',
					placeholder: 'Generate a new random secure password',
					validate: (value) => {
						if (!value) return 'Tool description is required';
					},
				}),
			toolTitle: () =>
				p.text({
					message: 'What is the title of the tool? It will be used as title inside Eney app.',
					placeholder: 'Generate Password',
					validate: (value) => {
						if (!value) return 'Tool title is required';
					},
				}),
		},
		{
			onCancel: () => {
				p.cancel('Operation cancelled.');
				process.exit(0);
			},
		}
	);

	return {
		mcpTitle: answers.mcpTitle,
		toolName: answers.toolName,
		toolDescription: answers.toolDescription,
		toolTitle: answers.toolTitle,
	};
}
