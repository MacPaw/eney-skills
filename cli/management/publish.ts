import { getToolsWithSchemas } from './extract-schemas.ts';
import { basename } from 'path';

const backendUrl = process.env.BACKEND_URL;
const accessToken = process.env.ADMIN_AUTH_TOKEN;

export async function publishExtension(cwd: string) {
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
	
		console.log(data);
	} catch (error) {
		console.error('Error publishing extension:', error);
	}
}
