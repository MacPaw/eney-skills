import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export type McpInfo = {
  name: string;
  version: string;
};

const mcpsDir = join(import.meta.dirname, "../../extensions");

export function getMcpsInfo(): McpInfo[] {
  let directories;

  try {
    directories = readdirSync(mcpsDir, { withFileTypes: true });
  } catch {
    console.error(`Error: MCPs directory not found: ${mcpsDir}`);
    process.exit(1);
  }

  const mcps = directories
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = join(mcpsDir, d.name, "manifest.json");

      if (manifestPath.indexOf(mcpsDir) !== 0) {
        console.error(`Invalid manifest path: ${manifestPath}`);
        return null;
      }

      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

        if (!manifest.version) {
          console.error(`Error: Version not found in manifest at ${manifestPath}`);
          return null;
        }

        if (!manifest.name) {
          console.error(`Error: Name not found in manifest at ${manifestPath}`);
          return null;
        }

        return {
          name: manifest.name,
          version: manifest.version,
        };
      } catch {
        console.error(`Error: Unable to read manifest at ${manifestPath}`);
        return null;
      }
    });

  return mcps.filter((m) => m !== null);
}
