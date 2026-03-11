# Eney Extension Helper CLI

Command-line tool for bundling Eney extension tools using esbuild.

## Setup

Link the CLI globally so you can run it from anywhere in the repo:

```bash
cd cli && npm link
```

This registers the `eney-skills-cli` command. After linking, use it instead of `node cli/main.ts`:

```bash
eney-skills-cli create --id my-mcp ...
eney-skills-cli dev
```
