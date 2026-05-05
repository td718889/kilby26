#!/bin/bash
# Kilby Block Party 2026 — Deploy via GitHub → Netlify auto-deploy

DIR="/Users/taylordankmyer/Documents/Claude/Projects/Kilby Block Party 2026"

cd "$DIR"

echo "🚀 Pushing to GitHub → Netlify will auto-deploy..."
git add index.html
git commit -m "KBP26 update"
git push --force origin main

echo "✅ Done! Live in ~30s at https://kilby26.netlify.app"
