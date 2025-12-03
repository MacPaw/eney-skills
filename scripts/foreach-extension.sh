#!/bin/bash
# Run a command in each extension directory
# Usage: ./scripts/foreach-extension.sh "npm i some-package@latest"
#        ./scripts/foreach-extension.sh "npm install"
#        ./scripts/foreach-extension.sh "cat manifest.json | jq .version"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSIONS_DIR="$SCRIPT_DIR/../extensions"

if [ -z "$1" ]; then
  echo "Usage: $0 \"<command>\""
  echo "Example: $0 \"npm i some-package@latest\""
  exit 1
fi

for dir in "$EXTENSIONS_DIR"/*/; do
  name=$(basename "$dir")
  echo "=== $name ==="
  (cd "$dir" && eval "$1")
  echo ""
done
