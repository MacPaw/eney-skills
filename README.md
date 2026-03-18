# Eney Skills

Monorepo for Eney extensions — MCP servers that expose interactive widgets to the Eney app.

## Repository Structure

- `extensions/` — production MCP extensions (each is a standalone Node.js server)
- `cli/` — scaffolding and dev tools for creating and running extensions
- `docs/` — widget API reference and guides (MDX, powers the documentation site)
- `website/` — documentation website (Next.js + Fumadocs)
- `scripts/` — CI/CD and utility scripts

## Getting Started

### Prerequisites

- Node.js 24+ (use `.node-version` with nvm/fnm for automatic switching)
- npm

### Setup

```bash
git clone https://github.com/MacPaw/eney-skills
cd eney-skills
npm run setup
```

This installs the CLI and makes the `eney-skills-cli` command available globally.

See the [Getting Started](/docs/getting-started) guide for a full walkthrough on creating your first extension.
