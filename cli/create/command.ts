import { join } from 'node:path';
import { readdir, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { copy } from 'fs-extra';
import handlebars from 'handlebars';
import * as p from '@clack/prompts';
import {
	askExtensionDetails,
	askExtensionId,
	askOutputDirectory,
	type ExtensionDetails,
	getFolderAction,
} from './prompt.ts';

const templateFolder = fileURLToPath(new URL('./template', import.meta.url));

type WalkEntry = {
	path: string;
	isDirectory: boolean;
};

async function* walkDirectory(directory: string): AsyncGenerator<WalkEntry> {
	const dirents = await readdir(directory, { withFileTypes: true });

	for (const dirent of dirents) {
		const fullPath = join(directory, dirent.name);

		if (dirent.isDirectory()) {
			yield { path: fullPath, isDirectory: true };
			yield* walkDirectory(fullPath);
		} else {
			yield { path: fullPath, isDirectory: false };
		}
	}
}

type CreateCommandOptions = {
	output?: string;
} & Partial<ExtensionDetails>;

export async function createCommand(options: CreateCommandOptions) {
	const isCI = process.env.CI === 'true';
	const requiredDetails: (keyof Omit<ExtensionDetails, 'extensionId'>)[] = [
		'extensionTitle',
		'toolName',
		'toolDescription',
		'toolTitle',
	];
	const hasAllDetails = requiredDetails.every((key) => options[key]);
	const hasAllOptions = options.extensionId !== undefined && hasAllDetails;

	if (!hasAllOptions && isCI) {
		console.error('Error: --id, --extension-title, --tool-name, --tool-description, and --tool-title are required in CI mode');
		process.exit(1);
	}

	const directoriesToRename: { oldPath: string; newPath: string }[] = [];

	p.intro('Create Extension');

	const outputDirectory = options.output || (await askOutputDirectory());
	const extensionId = options.extensionId || (await askExtensionId());
	const localOutputFolder = join(outputDirectory, extensionId);

	const folderAction = await getFolderAction(localOutputFolder);

	if (folderAction === 'cancel') {
		p.cancel('Operation cancelled.');
		process.exit(0);
	}

	const extensionDetails = hasAllDetails
		? (options as ExtensionDetails)
		: await askExtensionDetails();

	const fullDetails = {
		extensionId,
		...extensionDetails,
	};

	const spinner = p.spinner();
	spinner.start('Creating extension...');

	if (folderAction === 'overwrite') {
		await rm(localOutputFolder, { recursive: true, force: true });
	}

	await mkdir(localOutputFolder, { recursive: true });

	await copy(templateFolder, localOutputFolder, { overwrite: true, errorOnExist: false });

	for await (const entry of walkDirectory(localOutputFolder)) {
		if (entry.isDirectory) {
			if (!entry.path.includes('{{') && !entry.path.includes('}}')) {
				continue;
			}

			const updatedName = handlebars.compile(entry.path)(fullDetails);
			if (updatedName !== entry.path) {
				directoriesToRename.push({ oldPath: entry.path, newPath: updatedName });
			}
		} else {
			const content = await readFile(entry.path, 'utf8');
			const updatedContent = handlebars.compile(content)(fullDetails);
			await writeFile(entry.path, updatedContent, 'utf8');

			if (entry.path.endsWith('.hbs')) {
				const renamedPath = entry.path.replace(/\.hbs$/, '');
				await rename(entry.path, renamedPath);
			}
		}
	}

	const directoriesByDepth = directoriesToRename.sort((a, b) => b.oldPath.length - a.oldPath.length);

	for (const directory of directoriesByDepth) {
		await rename(directory.oldPath, directory.newPath);
	}

	spinner.stop('Extension created');

	const installSpinner = p.spinner();
	installSpinner.start('Installing dependencies...');

	await new Promise<void>((resolve, reject) => {
		exec('npm i @macpaw/eney-api@latest', { cwd: localOutputFolder }, (error) => {
			if (error) {
				return reject(error);
			}
			resolve();
		});
	});

	installSpinner.stop('Dependencies installed');

	p.outro(`Extension created at ${localOutputFolder}`);
}
