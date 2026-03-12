# eney-skills Project Memory

## Build Command

Always use `npm run build` to build/verify extensions — never `npx tsc --noEmit` or `npx tsc` directly.

## Project Structure

- `mcps/` — production MCP servers (each is a standalone Node.js server)
- `cli/` — scaffolding and dev tools
- `.agents/skills/` — local developer skills (eney-create, eney-debug, eney-docs)
- `docs/` — widget API reference docs (MDX)

## MCP Creation Workflow

1. `git checkout main && git pull && git checkout -b feat/<mcp-id>`
2. `eney-skills-cli create --id <mcp-id> --mcp-title "..." --tool-name <name> --tool-description "..." --tool-title "..." -o ./mcps`
3. Implement widgets in `mcps/<mcp-id>/components/`
4. `cd mcps/<mcp-id> && npm run build`

## Key Patterns

- AppleScript integration: use `runScript()` helper (see `notes-utilities-mcp/helpers/run-script.ts`)
- SQL DB access: use `useSQL()` from `@eney/api`
- Always use `.js` extensions for local imports (ESM requirement)
- All Zod schema fields need `.describe()` and should be `.optional()`
- Widget name in `defineWidget` uses hyphens; `commandID` in deeplinks uses underscores

## User Preferences

- Use `npm run build` (not `npx tsc`) for building/verifying MCPs
