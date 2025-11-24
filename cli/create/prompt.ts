import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { isKebabCase } from './utils.ts';

type ValidationResult = true | string;

type AskInputOptions = {
	message: string;
	hint?: string;
	validate?: (value: string) => ValidationResult;
};

async function askInput(options: AskInputOptions) {
	const readline = createInterface({ input, output });

	try {
		while (true) {
			const hint = options.hint ? `\n  ${options.hint}` : '';
			const value = (await readline.question(`${options.message}${hint}\n> `)).trim();
			const validationResult = options.validate ? options.validate(value) : true;

			if (validationResult === true) {
				return value;
			}

			console.log(validationResult);
		}
	} finally {
		readline.close();
	}
}

async function askConfirm(message: string) {
	const readline = createInterface({ input, output });

	try {
		while (true) {
			const value = (await readline.question(`${message} (y/N): `)).trim().toLowerCase();

			if (value === 'y' || value === 'yes') {
				return true;
			}

			if (value === 'n' || value === 'no' || value === '') {
				return false;
			}

			console.log('Please respond with "y" or "n".');
		}
	} finally {
		readline.close();
	}
}

export function askExtensionId() {
	return askInput({
		message: 'What is the id of the extension?',
		hint: 'Example: security-utilities',
		validate: (value) => {
			if (!value) {
				return 'Extension id is required';
			}

			if (!isKebabCase(value)) {
				return 'Extension id must be in kebab case, example: security-utilities';
			}

			return true;
		},
	});
}

export async function getFolderAction(outputFolder: string): Promise<'overwrite' | 'cancel' | 'create'> {
	try {
		await stat(outputFolder);

		console.log(`📂 Extension at "${outputFolder}" already exists`);

		const shouldOverwrite = await askConfirm('Do you want to overwrite the extension?');

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
	const extensionTitle = await askInput({
		message: 'What is the title of the extension?',
		hint: 'Example: Security Utilities',
		validate: (value) => (value ? true : 'Extension title is required'),
	});

	const toolName = await askInput({
		message: 'What is the name of the tool? It will be used as name of component file.',
		hint: 'Example: new-password',
		validate: (value) => (value ? true : 'Tool name is required'),
	});

	const toolDescription = await askInput({
		message: 'What is the description of the tool? It will be used for LLM to select the tool.',
		hint: 'Example: Generate a new random secure password',
		validate: (value) => (value ? true : 'Tool description is required'),
	});

	const toolTitle = await askInput({
		message: 'What is the title of the tool? It will be used as title inside Eney app.',
		hint: 'Example: Generate Password',
		validate: (value) => (value ? true : 'Tool title is required'),
	});

	return {
		extensionTitle,
		toolName,
		toolDescription,
		toolTitle,
	};
}
