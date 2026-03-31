#!/bin/bash
set -e
cd "$(dirname "$0")"

# Load secrets from local file (gitignored)
if [ -f .deploy-secrets ]; then
  source .deploy-secrets
fi

if [ -z "$GH_TOKEN" ]; then
  echo "Error: GH_TOKEN not set. Create .deploy-secrets with GH_TOKEN=..."
  exit 1
fi

echo "Building..."
npm run build

echo "Deploying to GitHub Pages..."

DEPLOY_DIR=$(mktemp -d)
cp -r dist/. "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

git init -q
git config user.email "karel@wingman.app"
git config user.name "Karel"
git checkout -b gh-pages
git add -A
git commit -m "Deploy" -q
git remote add origin "https://$GH_TOKEN@github.com/karel008-sudo/wingman-with-notes.git" 2>/dev/null || \
  git remote set-url origin "https://$GH_TOKEN@github.com/karel008-sudo/wingman-with-notes.git"
git push origin gh-pages --force -q

cd "$(dirname "$0")"
rm -rf "$DEPLOY_DIR"

echo "✅ Hotovo: https://karel008-sudo.github.io/wingman-with-notes/"
