import { getToolsWithSchemas } from './extract-schemas.ts';
import { basename } from 'path';

const backendUrl = process.env.BACKEND_URL;
const accessToken = process.env.ADMIN_AUTH_TOKEN;

export async function publishExtension(cwd: string, version: string, hash: string, downloadUrl: string) {
  const extensionName = basename(cwd);
	const tools = await getToolsWithSchemas(cwd);

	const payload = {
		extension_id: extensionName,
		tools,
	};

  console.dir(payload, { depth: null });

	if (!backendUrl || !accessToken) {
		throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
	}
	
	try {
		const response = await fetch(`${backendUrl}/admin/v3/mcp/tools`, {
			method: 'POST',
			body: JSON.stringify(payload),
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
		const payload = {
			version,
			hash,
			downloadUrl
		}

		console.dir(payload, { depth: null });

		const response = await fetch(`${backendUrl}/admin/v3/artifacts/extension/${extensionName}/versions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Token': accessToken
			},
			body: JSON.stringify(payload)
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
