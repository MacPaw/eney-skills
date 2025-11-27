import { z } from 'zod';
import fs from 'fs/promises';
import { join } from 'path';
import ts from 'typescript';

type JsonSchema = z.core.JSONSchema.BaseSchema;

type ToolWithSchema = {
  name: string;
  inputSchema: JsonSchema | Record<string, never>;
  [key: string]: unknown;
}

async function extractPropsSchemaExpression(filePath: string): Promise<string | null> {
	try {
		const fileContents = await fs.readFile(filePath, 'utf8');
		const sourceFile = ts.createSourceFile(filePath, fileContents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

		let initializer: ts.Expression | null = null;

		const visit = (node: ts.Node) => {
			if (initializer) {
				return;
			}

			if (
				ts.isVariableDeclaration(node) &&
				ts.isIdentifier(node.name) &&
				node.name.text === 'props' &&
				node.initializer
			) {
				initializer = node.initializer;
				return;
			}

			ts.forEachChild(node, visit);
		};

		visit(sourceFile);

		if (!initializer) {
			return null;
		}

		return initializer.getText(sourceFile).trim();
	} catch (error: any) {
		console.warn(`Failed to extract props schema from ${filePath}: ${error.message}`);
		return null;
	}
}

async function generateInputSchema(filePath: string): Promise<JsonSchema | null> {
	try {
		const schemaExpression = await extractPropsSchemaExpression(filePath);

		if (!schemaExpression) {
			console.warn(`Props schema not found in ${filePath}, skipping...`);
			return null;
		}

		let propsSchema;

		try {
			const evaluator = new Function('z', `return (${schemaExpression});`);
			propsSchema = evaluator(z);
		} catch (error: any) {
			console.warn(`Could not evaluate props schema in ${filePath}: ${error.message}`);
			return null;
		}

		const jsonSchema = z.toJSONSchema(propsSchema, {
			unrepresentable: 'any',
			override: (ctx) => {
				const def = ctx.zodSchema._zod.def;
				if (def.type === 'date') {
					ctx.jsonSchema.type = 'integer';
					ctx.jsonSchema.format = 'unix-time';
				}
			},
		});

		delete jsonSchema.additionalProperties;
		delete jsonSchema.$schema;

		return jsonSchema;
	} catch (error: any) {
		console.warn(`Could not generate schema for props in ${filePath}: ${error.message}`);
		return null;
	}
}

export async function getToolsWithSchemas(extensionDir: string) {
	const manifestPath = join(extensionDir, 'manifest.json');
	const toolsDir = join(extensionDir, 'tools');

	try {
		await fs.stat(extensionDir);
		await fs.stat(manifestPath);
		await fs.stat(toolsDir);

		const manifestContent = await fs.readFile(manifestPath, 'utf8');
		const manifestJson = JSON.parse(manifestContent);

		if (!manifestJson.tools || !Array.isArray(manifestJson.tools)) {
			console.warn(`No tools array found in ${manifestPath}`);
			return;
		}

		const toolsWithSchemas: ToolWithSchema[] = [];

		for (const tool of manifestJson.tools) {
			if (!tool.name) continue;

			const toolFilePath = join(toolsDir, `${tool.name}/main.tsx`);

			try {
				await fs.stat(toolFilePath);
			} catch {
				console.warn(`Warning: Tool file not found: ${toolFilePath}`);
				continue;
			}

			const schema = await generateInputSchema(toolFilePath);

			tool.inputSchema = schema || {};

			if (schema) {
				console.log(`Updated schema for tool: ${tool.name}`);
			} else {
				console.log(`No schema found for tool: ${tool.name}`);
			}

			toolsWithSchemas.push(tool);
		}

		return toolsWithSchemas;
	} catch (error) {
		console.error(`Error processing extension '${extensionDir}':`, error);
	}
}
