import { open, stat } from "node:fs/promises";
import { basename } from "node:path";

export type Privacy = "private" | "unlisted" | "public";

export interface UploadMetadata {
  title: string;
  description: string;
  tags: string[];
  privacy: Privacy;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

const CHUNK_SIZE = 4 * 1024 * 1024;

export async function uploadToYouTube(
  filePath: string,
  accessToken: string,
  metadata: UploadMetadata,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  const size = (await stat(filePath)).size;
  const uploadUrl = await initResumableUpload(filePath, accessToken, metadata, size);

  const fh = await open(filePath, "r");
  try {
    let offset = 0;
    while (offset < size) {
      const chunkSize = Math.min(CHUNK_SIZE, size - offset);
      const buf = Buffer.alloc(chunkSize);
      await fh.read(buf, 0, chunkSize, offset);
      const rangeEnd = offset + chunkSize - 1;

      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${offset}-${rangeEnd}/${size}`,
        },
        body: new Uint8Array(buf),
      });

      if (res.status === 308) {
        offset = rangeEnd + 1;
        onProgress(Math.floor((offset / size) * 100));
        continue;
      }
      if (res.status === 200 || res.status === 201) {
        const data = (await res.json()) as { id?: string };
        if (!data.id) throw new Error("Upload completed but YouTube returned no video id.");
        onProgress(100);
        return { videoId: data.id, url: `https://youtu.be/${data.id}` };
      }
      const text = await res.text();
      throw new Error(`YouTube upload failed (${res.status}): ${text.slice(0, 300)}`);
    }
    throw new Error("Upload finished without a success response.");
  } finally {
    await fh.close();
  }
}

async function initResumableUpload(
  filePath: string,
  accessToken: string,
  metadata: UploadMetadata,
  size: number,
): Promise<string> {
  const body = {
    snippet: {
      title: metadata.title || basename(filePath),
      description: metadata.description,
      tags: metadata.tags,
      categoryId: "22",
    },
    status: {
      privacyStatus: metadata.privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube init failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL.");
  return uploadUrl;
}
