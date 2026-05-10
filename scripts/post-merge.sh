#!/bin/bash
set -e
pnpm install --frozen-lockfile
bash scripts/update-readme-timestamp.sh
