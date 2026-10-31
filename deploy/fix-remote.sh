#!/usr/bin/env bash
# One-time fix so the auto-deploy timer can pull without an SSH key.
# The repo is public, so HTTPS works.
set -euo pipefail
cd "$(dirname "$0")/.."
git config --global --add safe.directory "$(pwd)" || true
git remote set-url origin https://github.com/crcptalink/media-app.git
echo "Remote is now:"
git remote -v
echo ""
echo "Test pull:"
git fetch origin main
git log --oneline -1 origin/main
echo "Done. The 2-minute timer will now be able to pull."
