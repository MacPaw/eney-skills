import { Storage } from "@google-cloud/storage";
import { basename } from "path";
import fs from "fs-extra";

export async function uploadToCloud(filePath: string) {
  const bucketName = "eney-assets";
  const fileName = basename(filePath);
  const destination = `extensions/${fileName}`;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const storage = new Storage({
    projectId: "macpaw-eney",
  });

  console.log(`Uploading ${fileName} to gs://${bucketName}/${destination}...`);

  await storage.bucket(bucketName).upload(filePath, {
    destination,
    predefinedAcl: "publicRead",
  });

  console.log(`Uploaded to gs://${bucketName}/${destination}`);
}

