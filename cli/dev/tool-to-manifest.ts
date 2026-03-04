import type { ToolWithSchema } from "../management/extract-mcp-tools.ts";

function toSnakeCase(str: string): string {
  return str.replace(/-/g, "_");
}

export async function getOpenLink(toolId: string) {
  return `eney://run?manifestID=eney_core&commandID=${toSnakeCase(toolId)}`;
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

export function toolToManifest(tool: ToolWithSchema, mcpName: string, mcpVersion: string): Record<string, any> {
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
