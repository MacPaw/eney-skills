#!/bin/bash

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

cd cli
npm install --no-fund --no-audit
npm link
echo ""
echo -e "${GREEN}✔ Setup complete!${NC} You can now start creating extensions."
echo ""
echo -e "${BOLD}To get started:${NC}"
echo -e "  ${CYAN}${NC} Read the docs: ${YELLOW}developers.eney.ai/docs/getting-started/${NC}"
