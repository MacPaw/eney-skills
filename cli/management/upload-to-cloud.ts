import { Storage } from "@google-cloud/storage";
import { basename } from "path";
import fs from "fs-extra";

export async function uploadToCloud(filePath: string, mode: string = "staging") {
  const bucketName = mode === "production" ? "eney-cdn-production" : "eney-cdn-staging";
  const fileName = basename(filePath);
  const destination = `extensions/${fileName}`;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const storage = new Storage({
    projectId: mode === "production" ? "macpaw-production" : "macpaw-staging",
  });

  console.log(`Uploading ${fileName} to gs://${bucketName}/${destination}...`);

  await storage.bucket(bucketName).upload(filePath, {
    destination,
  });

  console.log(`Uploaded to gs://${bucketName}/${destination}`);
}

