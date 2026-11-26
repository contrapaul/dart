#!/usr/bin/env bash
# DART: the build (type-check and bundle), the unit tests and the text checks.
set -e
cd "$(dirname "$0")/.."
npx tsc --noEmit
npx vitest run --reporter=dot
node tools/check-no-em-dash.mjs
