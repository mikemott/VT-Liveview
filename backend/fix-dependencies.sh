#!/bin/bash
# Fix backend dependency issue - @fastify/rate-limit version mismatch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "Cleaning backend dependencies..."
cd "$BACKEND_DIR" || exit 1
rm -rf node_modules package-lock.json

echo "Installing dependencies with correct versions..."
npm install

echo "Done! Now run: npm run dev"
