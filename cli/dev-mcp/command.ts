import { resolve, basename, join } from "path";
import { homedir } from "os";
import { watch } from "fs";
import { execSync } from "child_process";
import { cp, readFile, mkdir, writeFile } from "fs/promises";
import color from "picocolors";
import { debounce } from "es-toolkit";
import { extractMcpTools, type ToolWithSchema } from "../management/extract-mcp-tools.ts";

const MCPS_FOLDER = resolve(
  homedir(),
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP",
);

const TOOLS_FOLDER = resolve(homedir(), ".eney", "tools");

function toSnakeCase(str: string): string {
  return str.replace(/-/g, "_");
}

function jsonSchemaPropertyToTypeMetadata(prop: Record<string, any>): Record<string, any> {
  if (prop.enum) {
    return {
      element: "select",
      options: prop.enum.map((value: any) => ({ name: String(value), value })),
    };
  }

  switch (prop.type) {
    case "boolean":
      return { element: "boolean" };

    case "number":
    case "integer":
      return {
        element: "number",
        contentType: prop.type === "integer" ? "int" : "float",
        min: prop.minimum ?? null,
        max: prop.maximum ?? null,
        step: null,
        precision: null,
      };

    case "string":
    default:
      return {
        element: "text",
        contentType: "text",
        minLength: prop.minLength ?? null,
        maxLength: prop.maxLength ?? null,
        pattern: prop.pattern ?? null,
      };
  }
}

function toolToManifest(
  tool: ToolWithSchema,
  mcpName: string,
  mcpVersion: string,
): Record<string, any> {
  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  const inputParameters = Object.entries(properties).map(([key, prop]: [string, any]) => ({
    multiple: false,
    id: key,
    description: prop.description || "",
    required: required.includes(key),
    name: key,
    placeholder: prop.description || "",
    typeMetadata: jsonSchemaPropertyToTypeMetadata(prop),
    concatenationRules: null,
    default: prop.default ?? null,
  }));

  return {
    implicitConfirmationRequired: false,
    reparseRequired: false,
    processCommandOutputWithLlm: true,
    usesThirdPartyProviders: false,
    supportsLocalEngine: false,
    id: toSnakeCase(tool.name),
    manifestId: "eney_core",
    name: tool.name,
    description: tool.description || "",
    status: "ACTIVE",
    category: null,
    contentVersion: mcpVersion,
    syntaxVersion: 4,
    inputParameters,
    outputUI: [],
    dependencies: [],
    icon: {
      type: "predefined",
      identifier: "generic",
    },
    messageTexts: {
      inputParametersCtaButtonLabel: "Submit",
    },
    onboardingConfig: {
      title: tool.name,
      visible: false,
    },
    execution: {
      type: "mcp",
      mode: "local",
      toolName: tool.name,
      version: mcpVersion,
      artifactId: mcpName,
    },
  };
}

async function buildAndDeploy(mcpDir: string, outFolder: string) {
  execSync("npx tsc", { cwd: mcpDir, stdio: "inherit" });

  const manifestPath = resolve(mcpDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const mcpName = manifest.name || basename(mcpDir);
  const mcpVersion = manifest.version || "1.0.0";

  const distDir = resolve(mcpDir, "dist");
  const targetDir = resolve(outFolder, mcpName);

  await cp(distDir, targetDir, { recursive: true, force: true });
  await cp(manifestPath, join(targetDir, "manifest.json"), { force: true });

  const nodeModules = resolve(mcpDir, "node_modules");
  await cp(nodeModules, join(targetDir, "node_modules"), { recursive: true, force: true });

  // Extract tools and generate tool manifests in ~/.eney/tools/
  console.log(color.bold(color.cyan("Extracting tools...")));
  const tools = await extractMcpTools(mcpDir);
  await mkdir(TOOLS_FOLDER, { recursive: true });

  for (const tool of tools) {
    const toolManifest = toolToManifest(tool, mcpName, mcpVersion);
    const toolPath = join(TOOLS_FOLDER, `${tool.name}.json`);
    await writeFile(toolPath, JSON.stringify(toolManifest, null, 2));
    console.log(color.bold(color.cyan(`  → ${toolPath}`)));
  }

  return targetDir;
}

async function devMcp() {
  const currentFolder = process.cwd();

  console.log(color.bold(color.green(`Watching ${currentFolder} for changes...`)));

  const build = async (filename?: string) => {
    if (filename) {
      console.log(color.bold(color.green(`File ${filename} changed`)));
    }
    console.log(color.bold(color.green("Building...")));
    try {
      const targetDir = await buildAndDeploy(currentFolder, MCPS_FOLDER);
      console.log(color.bold(color.green(`Build complete! Deployed to: ${targetDir}`)));
    } catch (error) {
      console.error(color.bold(color.red("Build failed:")));
      console.error(error);
    }
  };

  const debouncedBuild = debounce(build, 1000);

  await build();

  watch(currentFolder, { recursive: true }, async (_event, filename) => {
    if (
      filename === "package-lock.json" ||
      filename.startsWith("node_modules/") ||
      filename.startsWith("dist/")
    ) {
      return;
    }

    debouncedBuild(filename);
  });
}

export async function devMcpCommand() {
  console.log("Starting MCP dev...");
  await devMcp();
}
