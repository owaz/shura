#!/bin/bash
# ============================================================
# Shura Frontend — Azure Container Apps Environment Variables
# ============================================================
# NOTE: Vite bakes env vars at BUILD TIME. These are only useful
# if your frontend container rebuilds on startup using the vars.
# If you use a static build (recommended), set these in your
# CI/CD pipeline instead (GitHub Actions secrets → .env file).
#
# Usage: bash scripts/set-env-frontend.sh
# Prerequisites: az login
# ============================================================

RESOURCE_GROUP="<your-resource-group>"
CONTAINER_APP_NAME="<shura-frontend-container-app-name>"

az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    VITE_API_URL="https://<your-backend-container-app-domain>" \
    VITE_WS_URL="https://<your-backend-container-app-domain>" \
    VITE_AUTH0_DOMAIN="auth.shura.life" \
    VITE_AUTH0_CLIENT_ID="<spa-client-id>" \
    VITE_AUTH0_AUDIENCE="https://api.shura.life"

echo "Frontend env vars applied to: $CONTAINER_APP_NAME"
