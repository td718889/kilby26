#!/bin/bash
# Kilby Block Party 2026 — Safe deploy via GitHub → Netlify auto-deploy.
#
# This script does NOT use --force, so it will refuse to overwrite work that
# was published from the live site (or another tab/device) since the local
# copy was last synced. If you see a "rejected (non-fast-forward)" error,
# pull first (git pull --rebase origin main) and run this again.

set -e
DIR="/Users/taylordankmyer/Documents/Claude/Projects/Kilby Block Party 2026"
cd "$DIR"

# Clean up any stale lock files left behind by interrupted git operations.
rm -f .git/index.lock
find .git -maxdepth 2 -name '*.lock' -delete 2>/dev/null || true
find .git/objects -name 'tmp_obj_*' -delete 2>/dev/null || true

echo "🔄 Syncing with origin to catch any live-site publishes..."
git fetch origin

# If origin is ahead, rebase local commits/changes on top.
if [ -n "$(git log HEAD..origin/main --oneline 2>/dev/null)" ]; then
  echo "  origin is ahead — rebasing..."
  # Stash any uncommitted changes so the rebase has a clean tree.
  STASHED=0
  if ! git diff-index --quiet HEAD --; then
    git stash push -u -m "deploy.sh autostash"
    STASHED=1
  fi
  git pull --rebase origin main
  if [ "$STASHED" = "1" ]; then
    git stash pop || {
      echo "❌ Stash pop hit a conflict. Resolve in index.html, then run:"
      echo "   git add index.html && git stash drop && ./deploy.sh"
      exit 1
    }
  fi
fi

echo ""
echo "🚀 Pushing to GitHub → Netlify will auto-deploy..."
git add -u
if ! git diff-index --quiet HEAD --cached --; then
  git commit -m "KBP26 update"
fi
git push origin main

echo ""
echo "✅ Done! Live in ~30s at https://kilby26.netlify.app"
