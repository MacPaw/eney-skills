import { getToolsWithSchemas } from './extract-schemas.ts';
import { basename } from 'path';
import semver from 'semver';
import { publishExtension, publishExtensionVersion } from '../lib/api.ts';

export async function publishExtensionCommand(cwd: string, version: string, hash: string, downloadUrl: string, dryRun = false) {
  const extensionName = basename(cwd);
	const tools = await getToolsWithSchemas(cwd);

	const parsedVersion = semver.coerce(version).toString();
	if (!parsedVersion) {
		throw new Error(`Invalid version: ${version}`);
	}

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
		const data = await publishExtension({
			extension_id: extensionName,
			version: parsedVersion,
			hash,
			downloadUrl
		});
	
		console.log('Extension published successfully:', data);
	} catch (error) {
		console.error('Error publishing extension:', error);
		throw error;
	}

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
