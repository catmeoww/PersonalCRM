#!/usr/bin/env bash
# Daily backup of PersonalCRM SQLite DB to a Google Cloud Storage bucket.
# Usage: BUCKET=gs://my-bucket ./scripts/backup.sh
set -euo pipefail

BUCKET="${BUCKET:?set BUCKET=gs://your-bucket}"
DB_PATH="${DB_PATH:-/opt/personalcrm/data/personalcrm.sqlite}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp -d)"
OUT="${TMP}/personalcrm-${STAMP}.sqlite"

# Online backup using sqlite3's .backup command — safe while app is running.
sqlite3 "${DB_PATH}" ".backup '${OUT}'"
gzip "${OUT}"

gsutil cp "${OUT}.gz" "${BUCKET}/personalcrm-${STAMP}.sqlite.gz"
rm -rf "${TMP}"
echo "Backed up to ${BUCKET}/personalcrm-${STAMP}.sqlite.gz"
