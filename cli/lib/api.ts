const accessToken = process.env.ADMIN_AUTH_TOKEN;

type ExtensionVersion = {
  artifactType: 'extension';
  artifactId: string;
  version: string;
  hash: string;
  downloadUrl: string;
  createdAt: string;
}

export async function setupFetchClient(mode: "staging" | "production" = "staging") {
  const backendUrl =  mode === 'staging' ? `https://core.eney.appflix.io` : `https://core.internal.eney.ai`;

  if (!accessToken) {
		throw new Error('ADMIN_AUTH_TOKEN must be set');
	}

  const newFetch = (url: string, options: RequestInit) => {
    return fetch(`${backendUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': accessToken,
      },
    });
  }

  return { fetchClient: newFetch };
}

export async function getExtensionVersions(extensionName: string, fetch: (url: string, options: RequestInit) => Promise<Response>) {
  try {
    const response = await fetch(`/admin/v3/artifacts/extension/${extensionName}/versions`, { method: 'GET' });

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
  tools: Record<string, any>[];
  version: string;
}

export async function publishExtension(payload: PublishExtensionPayload, fetch: (url: string, options: RequestInit) => Promise<Response>) {
  try {
    const response = await fetch(`/admin/v3/extensions/tools`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish extension: ${response.status} ${response.statusText} ${await response.text()}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error(`\nError publishing extension!\n${error}`);
    throw error;
  }
}

type PublishExtensionVersionPayload = {
  version: string;
  hash: string;
  downloadUrl: string;
}

export async function publishExtensionVersion(extensionName: string, payload: PublishExtensionVersionPayload, fetch: (url: string, options: RequestInit) => Promise<Response>) {
  try {
    const response = await fetch(`/admin/v3/artifacts/extension/${extensionName}/versions`, {
      method: 'POST',
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
