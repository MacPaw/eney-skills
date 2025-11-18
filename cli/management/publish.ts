import { getToolsWithSchemas } from './extract-schemas.ts';
import { basename } from 'path';
import semver from 'semver';

const backendUrl = process.env.BACKEND_URL;
const accessToken = process.env.ADMIN_AUTH_TOKEN;

export async function publishExtension(cwd: string, version: string, hash: string, downloadUrl: string, dryRun = false) {
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

	if (!backendUrl || !accessToken) {
		throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
	}
	
	try {
		const response = await fetch(`${backendUrl}/admin/v3/extensions/tools`, {
			method: 'POST',
			body: JSON.stringify(metadataPayload),
			headers: {
				'Content-Type': 'application/json',
				'X-API-Token': accessToken,
			},
		});
	
		const data = await response.json();
	
		console.log('Extension published successfully:', data);
	} catch (error) {
		console.error('Error publishing extension:', error);
		throw error;
	}

	try {
		const response = await fetch(`${backendUrl}/admin/v3/artifacts/extension/${extensionName}/versions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Token': accessToken
			},
			body: JSON.stringify(artifactPayload)
		})

		const data = await response.json();

		if (!response.ok) {
			throw new Error(`Failed to publish extension version: ${response.status} ${response.statusText}\n${JSON.stringify(data)}`);
		}
	
		console.log('Extension version published successfully:', data);
	} catch (error) {
		console.error('Error publishing extension:', error);
		throw error;
	}
}
