import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { ExtensionInfo } from "./types.ts";

const extensionsDir = join(import.meta.dirname, "../../extensions");

export function getExtensionsInfo(): ExtensionInfo[] {
  const extensions = readdirSync(extensionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifest = JSON.parse(readFileSync(join(extensionsDir, d.name, "manifest.json"), "utf8"));
      const version = manifest.version;

      return {
        name: d.name,
        version: version,
      };
    });

  return extensions;
}
