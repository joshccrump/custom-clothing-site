{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 #!/usr/bin/env bash\
set -euo pipefail\
\
# >>> EDIT THESE IF NEEDED <<<\
OWNER="joshccrump"\
REPO="custom-clothing-site"\
BRANCH="main"\
PATHROOT="/"\
\
# --- Require GitHub CLI auth ---\
if ! gh auth status -t >/dev/null 2>&1; then\
  echo "You are not logged in to GitHub CLI. Run: gh auth login"\
  exit 1\
fi\
\
echo "Enabling GitHub Pages for $OWNER/$REPO on branch '$BRANCH' at path '$PATHROOT'..."\
\
# Try creating the Pages site (works if not created yet)\
if ! gh api -X POST -H "Accept: application/vnd.github+json" \\\
  "repos/$OWNER/$REPO/pages" \\\
  -f "source[branch]=$BRANCH" -f "source[path]=$PATHROOT" >/dev/null 2>&1; then\
  # If it already exists, update it\
  gh api -X PUT -H "Accept: application/vnd.github+json" \\\
    "repos/$OWNER/$REPO/pages" \\\
    -f "source[branch]=$BRANCH" -f "source[path]=$PATHROOT" >/dev/null\
fi\
\
# Fetch the Pages URL\
URL="$(gh api -H "Accept: application/vnd.github+json" \\\
  "repos/$OWNER/$REPO/pages" --jq '.html_url')"\
\
if [[ -z "$\{URL\}" || "$\{URL\}" == "null" ]]; then\
  echo "Could not retrieve Pages URL. Check repo settings and try again."\
  exit 1\
fi\
\
echo "GitHub Pages URL: $URL"\
echo "Waiting for the site to become available..."\
\
# Poll until the site responds (200/404 means the domain is up; content may still build)\
for i in \{1..12\}; do\
  CODE="$(curl -s -o /dev/null -w "%\{http_code\}" "$URL")" || CODE="000"\
  if [[ "$CODE" == "200" || "$CODE" == "404" ]]; then\
    echo "Site responding (HTTP $CODE)."\
    break\
  fi\
  echo "\'85build in progress ($i/12). Retrying in 10s."\
  sleep 10\
done\
\
# Open in default browser (macOS)\
open "$URL"\
\
echo "Done. If you see a 404 on first load, give it a minute and refresh."\
}