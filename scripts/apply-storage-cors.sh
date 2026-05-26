#!/usr/bin/env bash
# Apply GCS CORS to the Firebase Storage bucket so browser uploads/downloads work.
# Firebase CLI deploys storage.rules but does NOT set bucket CORS - run this once
# per bucket (and again when adding a new production origin).
#
# Prerequisites: Google Cloud SDK (gsutil) authenticated for the project.
#
# Usage:
#   ./scripts/apply-storage-cors.sh
#   ./scripts/apply-storage-cors.sh gs://buy-the-way-2ac6e.firebasestorage.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORS_FILE="${ROOT}/firebase/storage.cors.json"

if [[ ! -f "$CORS_FILE" ]]; then
  echo "Missing ${CORS_FILE}" >&2
  exit 1
fi

BUCKET="${1:-}"
if [[ -z "$BUCKET" ]]; then
  # Match Vite load order: .env then .env.local (local wins).
  for env_file in "${ROOT}/.env" "${ROOT}/.env.local"; do
    if [[ -f "$env_file" ]]; then
      # shellcheck disable=SC1090
      set -a
      source "$env_file"
      set +a
    fi
  done
  BUCKET="${VITE_FIREBASE_STORAGE_BUCKET:-}"
fi

if [[ -z "$BUCKET" ]]; then
  echo "Pass the bucket or set VITE_FIREBASE_STORAGE_BUCKET in .env or .env.local" >&2
  echo "Example: ./scripts/apply-storage-cors.sh gs://buy-the-way-2ac6e.firebasestorage.app" >&2
  exit 1
fi

if [[ "$BUCKET" != gs://* ]]; then
  BUCKET="gs://${BUCKET}"
fi

if ! command -v gsutil >/dev/null 2>&1; then
  echo "gsutil not found. Install the Google Cloud SDK, then retry." >&2
  exit 1
fi

echo "Applying CORS from firebase/storage.cors.json to ${BUCKET} ..."
gsutil cors set "$CORS_FILE" "$BUCKET"
echo "Done. Verify with: gsutil cors get ${BUCKET}"
