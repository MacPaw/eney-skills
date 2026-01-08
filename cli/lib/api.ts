import { Storage } from "@google-cloud/storage";
import { basename } from "path";
import fs from "fs-extra";

type ExtensionVersion = {
  artifactType: "extension";
  artifactId: string;
  version: string;
  hash: string;
  downloadUrl: string;
  createdAt: string;
};

type PublishExtensionPayload = {
  extension_id: string;
  tools: Record<string, any>[];
  version: string;
};

type PublishExtensionVersionPayload = {
  version: string;
  hash: string;
  downloadUrl: string;
};

export class ApiClient {
  private mode: "staging" | "production";
  private backendUrl: string;
  private accessToken: string;

  constructor(mode: "staging" | "production" = "staging") {
    this.mode = mode;
    this.backendUrl = mode === "staging" ? "https://core.eney.appflix.io" : "https://core.internal.eney.ai";

    const token = process.env[`ADMIN_AUTH_TOKEN_${mode.toUpperCase()}`];
    if (!token) {
      throw new Error(`ADMIN_AUTH_TOKEN_${mode.toUpperCase()} must be set`);
    }
    this.accessToken = token;
  }

  private fetch(url: string, options: RequestInit = {}) {
    return fetch(`${this.backendUrl}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": this.accessToken,
      },
    });
  }

  async getExtensionVersions(extensionName: string): Promise<ExtensionVersion[]> {
    try {
      const response = await this.fetch(`/admin/v3/artifacts/extension/${extensionName}/versions`, { method: "GET" });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`Failed to get extension versions: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`\nError getting extension versions!\n${error.message}`);
      throw error;
    }
  }

  async publishExtension(payload: PublishExtensionPayload) {
    try {
      const response = await this.fetch(`/admin/v3/extensions/tools`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to publish extension: ${response.status} ${response.statusText} ${await response.text()}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`\nError publishing extension!\n${error}`);
      throw error;
    }
  }

  async publishExtensionVersion(extensionName: string, payload: PublishExtensionVersionPayload) {
    try {
      const response = await this.fetch(`/admin/v3/artifacts/extension/${extensionName}/versions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish extension version: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`\nError publishing extension version!\n${error.message}`);
      throw error;
    }
  }

  async uploadExtensionArchiveToCloud(filePath: string) {
    const bucketName = this.mode === "production" ? "eney-cdn-production" : "eney-cdn-staging";
    const projectId = this.mode === "production" ? "macpaw-production" : "macpaw-staging";
    const fileName = basename(filePath);
    const destination = `extensions/${fileName}`;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const storage = new Storage({ projectId });

    console.log(`Uploading ${fileName} to gs://${bucketName}/${destination}...`);

    await storage.bucket(bucketName).upload(filePath, {
      destination,
    });

    console.log(`Uploaded to gs://${bucketName}/${destination}`);
  }
}
