## How to contribute to Eney Skills

### Prerequisites

- **SSH commit signing must be enabled.** All commits must be cryptographically signed. Run `/ssh-signing` in Claude Code or follow the [GitHub docs](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification#ssh-commit-signature-verification) to set it up.

### Creating a new skill

1. Create a branch from `main`: `git checkout -b feat/<id>`
2. Follow the [Getting Started](https://developers.eney.ai/docs/getting-started) guide to scaffold and implement your skill.
3. Verify it builds: `cd extensions/<id> && npm run build`
4. Create a Pull Request to `main` describing what the skill does and how to test it.

Thanks! ❤️
