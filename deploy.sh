#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Building..."
npm run build

echo "Deploying to Netlify..."
SITE_ID="b588a256-0346-4ec0-9d1d-dfcadf17acd7"
TOKEN="nfp_Xie5BbzZfVrEdCcwq6Bm2Zj9djcV9JS101b6"

cd dist && zip -r /tmp/gym-diary-dist.zip . -x "*.DS_Store" && cd ..

RESULT=$(curl -s -X POST "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @/tmp/gym-diary-dist.zip)

URL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ssl_url') or d.get('url','?'))" 2>/dev/null)
echo "✅ Hotovo: https://gym-diary-kp.netlify.app"
rm /tmp/gym-diary-dist.zip
