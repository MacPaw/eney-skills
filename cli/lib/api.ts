import { Storage } from "@google-cloud/storage";
import { basename } from "path";
import fs from "fs-extra";

type PublishMcpPayload = {
  artifactId: string;
  tools: Record<string, any>[];
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
    this.backendUrl =
      mode === "production"
        ? "https://extensions.api.eney.ai/api/v1/public"
        : "https://extensions.eney.appflix.io/api/v1/public";

    const token = process.env["API_TOKEN"];
    if (!token) {
      throw new Error(`API_TOKEN must be set`);
    }
    this.accessToken = token;
  }

  private fetch(url: string, options: RequestInit = {}) {
    return fetch(`${this.backendUrl}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  async publishMcp(payload: PublishMcpPayload) {
    try {
      const response = await this.fetch(`/publish/mcp-extensions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish MCP: ${response.status} ${response.statusText} ${await response.text()}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`\nError publishing MCP!\n${error}`);
      throw error;
    }
  }

  async uploadMcpArchiveToCloud(filePath: string) {
    const bucketName = this.mode === "production" ? "eney-cdn-production" : "eney-cdn-staging";
    const projectId = this.mode === "production" ? "macpaw-production" : "macpaw-staging";
    const fileName = basename(filePath);
    const destination = `mcps/${fileName}`;

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

  async deleteMcpArtifactFromCloud(fileName: string) {
    if (!fileName?.trim()) {
      throw new Error("fileName is required");
    }

    if (fileName.includes("..") || fileName.startsWith("/")) {
      throw new Error("Invalid fileName: path traversal not allowed");
    }

    const bucketName = this.mode === "production" ? "eney-cdn-production" : "eney-cdn-staging";
    const projectId = this.mode === "production" ? "macpaw-production" : "macpaw-staging";
    const destination = `mcps/${fileName}`;

    const storage = new Storage({ projectId });
    const file = storage.bucket(bucketName).file(destination);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: gs://${bucketName}/${destination}`);
    }

    console.log(`Deleting gs://${bucketName}/${destination}...`);

    await file.delete();

    console.log(`Deleted gs://${bucketName}/${destination}`);
  }

  async listMcpArchivesInCloud(prefix?: string) {
    const bucketName = this.mode === "production" ? "eney-cdn-production" : "eney-cdn-staging";
    const projectId = this.mode === "production" ? "macpaw-production" : "macpaw-staging";

    if (prefix?.includes("..") || prefix?.startsWith("/")) {
      throw new Error("Invalid prefix: path traversal not allowed");
    }

    const fullPrefix = prefix ? `mcps/${prefix}` : "mcps/";

    const storage = new Storage({ projectId });

    const [files] = await storage.bucket(bucketName).getFiles({ prefix: fullPrefix });

    return files.map((file) => ({
      name: file.name,
      size: file.metadata.size ? Number(file.metadata.size) : 0,
      created: file.metadata.timeCreated ? new Date(file.metadata.timeCreated) : null,
      updated: file.metadata.updated ? new Date(file.metadata.updated) : null,
    }));
  }
}

export function getMcpFileDownloadUrl(filePath: string, mode: "staging" | "production" = "staging"): string {
  return mode === "production"
    ? `https://cdn.eney.ai/mcps/${basename(filePath)}`
    : `https://staging-cdn.eney.ai/mcps/${basename(filePath)}`;
}
