#!/bin/sh
set -e

if [ ! -d node_modules ]; then
  npm install
elif [ ! -f node_modules/.package-lock.json ]; then
  npm install
elif [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
else
  node -e "require.resolve('i18next')" >/dev/null 2>&1 || npm install
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
