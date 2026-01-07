import { stat } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { isKebabCase } from './utils.ts';

export async function askExtensionId(): Promise<string> {
	const value = await p.text({
		message: 'What is the id of the extension?',
		placeholder: 'security-utilities',
		validate: (value) => {
			if (!value) {
				return 'Extension id is required';
			}

			if (!isKebabCase(value)) {
				return 'Extension id must be in kebab case, example: security-utilities';
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
	try {
		await stat(outputFolder);

		p.log.warn(`Extension at "${outputFolder}" already exists`);

		const shouldOverwrite = await p.confirm({
			message: 'Do you want to overwrite the extension?',
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

export type ExtensionDetails = {
	extensionId: string;
	extensionTitle: string;
	toolName: string;
	toolDescription: string;
	toolTitle: string;
};

export async function askExtensionDetails(): Promise<Omit<ExtensionDetails, 'extensionId'>> {
	const answers = await p.group(
		{
			extensionTitle: () =>
				p.text({
					message: 'What is the title of the extension?',
					placeholder: 'Security Utilities',
					validate: (value) => {
						if (!value) return 'Extension title is required';
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
		extensionTitle: answers.extensionTitle,
		toolName: answers.toolName,
		toolDescription: answers.toolDescription,
		toolTitle: answers.toolTitle,
	};
}
