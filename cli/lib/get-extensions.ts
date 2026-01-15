import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { ExtensionInfo } from "./types.ts";

const extensionsDir = join(import.meta.dirname, "../../extensions");

export function getExtensionsInfo(): ExtensionInfo[] {
  let directories;

  try {
    directories = readdirSync(extensionsDir, { withFileTypes: true });
  } catch {
    console.error(`Error: Extensions directory not found: ${extensionsDir}`);
    process.exit(1);
  }

  const extensions = directories
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = join(extensionsDir, d.name, "manifest.json");

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

        if (!manifest.version) {
          console.error(`Error: Version not found in manifest at ${manifestPath}`);
          return null;
        }

        return {
          name: d.name,
          version: manifest.version,
        };
      } catch {
        console.error(`Error: Unable to read manifest at ${manifestPath}`);
        return null;
      }
    });

  return extensions.filter((e) => e !== null);
}
