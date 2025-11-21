const backendUrl = process.env.BACKEND_URL;
const accessToken = process.env.ADMIN_AUTH_TOKEN;

type ExtensionVersion = {
  artifactType: 'extension';
  artifactId: string;
  version: string;
  hash: string;
  downloadUrl: string;
  createdAt: string;
}

export async function getExtensionVersions(extensionName: string) {
  if (!backendUrl || !accessToken) {
		throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
	}

  try {
    const response = await fetch(`${backendUrl}/admin/v3/artifacts/extension/${extensionName}/versions`, {
      method: 'GET',
      headers: {
        'X-API-Token': accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get extension versions: ${response.status} ${response.statusText}`);
    }

    const data: ExtensionVersion[] = await response.json();

    return data;
  } catch (error) {
    console.error(`\nError getting extension versions!\n${error.message}`);
    throw error;
  }
}

type PublishExtensionPayload = {
  extension_id: string;
  version: string;
  hash: string;
  downloadUrl: string;
}

export async function publishExtension(payload: PublishExtensionPayload) {
  if (!backendUrl || !accessToken) {
    throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
  }

  try {
    const response = await fetch(`${backendUrl}/admin/v3/extensions/tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish extension: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error(`\nError publishing extension!\n${error.message}`);
    throw error;
  }
}

type PublishExtensionVersionPayload = {
  version: string;
  hash: string;
  downloadUrl: string;
}

export async function publishExtensionVersion(extensionName: string, payload: PublishExtensionVersionPayload) {
  if (!backendUrl || !accessToken) {
    throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
  }

  try {
    const response = await fetch(`${backendUrl}/admin/v3/artifacts/extension/${extensionName}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish extension version: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
      console.error(`\nError publishing extension version!\n${error.message}`);
      throw error;
    }
  }
