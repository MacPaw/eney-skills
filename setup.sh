#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/cli"

npm install --no-fund --no-audit
npm link

NPM_BIN_DIR="$(npm config get prefix)/bin"

echo ""
echo -e "${GREEN}✔ Setup complete!${NC} You can now start creating extensions."
echo ""
echo -e "${BOLD}To get started:${NC}"
echo -e "  ${CYAN}${NC} Use the CLI: ${YELLOW}eney-skills-cli --help${NC}"
echo -e "  ${CYAN}${NC} Read the docs: ${YELLOW}developers.eney.ai/docs/getting-started/${NC}"

if ! command -v eney-skills-cli >/dev/null 2>&1; then
  echo ""
  echo -e "${YELLOW}! eney-skills-cli is linked, but not available in the current shell.${NC}"
  echo -e "  Add ${YELLOW}${NPM_BIN_DIR}${NC} to your PATH."
fi
