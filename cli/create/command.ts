import { join } from 'node:path';
import { readdir, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { copy } from 'fs-extra';
import handlebars from 'handlebars';
import * as p from '@clack/prompts';
import {
	askExtensionDetails,
	askExtensionId,
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
	p.intro('Create Extension');

	const directoriesToRename: { oldPath: string; newPath: string }[] = [];
	const extensionId = options.extensionId || (await askExtensionId());

	const output = options.output || process.cwd();
	const localOutputFolder = join(output, extensionId);

	const folderAction = await getFolderAction(localOutputFolder);

	if (folderAction === 'cancel') {
		p.cancel('Operation cancelled.');
		process.exit(0);
	}

	const requiredDetails: (keyof Omit<ExtensionDetails, 'extensionId'>)[] = [
		'extensionTitle',
		'toolName',
		'toolDescription',
		'toolTitle',
	];

	const hasAllDetails = requiredDetails.every((key) => options[key]);

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

	p.outro(`Extension created at ${localOutputFolder}`);
}
