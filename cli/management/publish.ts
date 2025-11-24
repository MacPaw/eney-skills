import { basename, join } from 'path';
import semver from 'semver';
import fs from 'fs/promises';

import { publishExtension, publishExtensionVersion } from '../lib/api.ts';

import { getToolsWithSchemas } from './extract-schemas.ts';
import { getFileDownloadUrl, getFileHash, packExtension } from './pack.ts';
import { uploadToCloud } from './upload-to-cloud.ts';

export async function publishExtensionCommand(cwd: string, dryRun = false) {
  const extensionName = basename(cwd);
	const tools = await getToolsWithSchemas(cwd);

	const manifest = JSON.parse(await fs.readFile(join(cwd, 'manifest.json'), 'utf8'));
	const parsedVersion = semver.coerce(manifest.version).toString();
	
	const archivePath = await packExtension(cwd);
	const hash = await getFileHash(archivePath);
	const downloadUrl = await getFileDownloadUrl(archivePath);

	const metadataPayload = {
		extension_id: extensionName,
		tools,
		version: parsedVersion,
	};

	console.dir(metadataPayload, { depth: null });

	const artifactPayload = {
		version: parsedVersion,
		hash,
		downloadUrl
	};

	console.dir(artifactPayload, { depth: null });

	if (dryRun) {
		console.log('Dry run enabled: skipping remote publish calls.');
		return;
	}

	try {
		const data = await publishExtension(metadataPayload);
	
		console.log('Extension published successfully:', data);
	} catch (error) {
		console.error('Error publishing extension:', error);
		throw error;
	}
	
	await uploadToCloud(archivePath);

	await fs.rm(archivePath, { force: true });

	try {
		const data = await publishExtensionVersion(extensionName, {
			version: parsedVersion,
			hash,
			downloadUrl
		});
	
		console.log('Extension version published successfully:', data);
	} catch (error) {
		console.error('Error publishing extension:', error);
		throw error;
	}
}
