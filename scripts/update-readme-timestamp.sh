#!/bin/bash
DATE=$(date -u)
sed -i "s/Last updated: .*/Last updated: $DATE/" artifacts/xmum-admin/README.md
sed -i "s/Last updated: .*/Last updated: $DATE/" artifacts/xmum-market/README.md
git add artifacts/xmum-admin/README.md artifacts/xmum-market/README.md
