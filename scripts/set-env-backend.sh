#!/bin/bash
# ============================================================
# Shura Backend — Azure Container Apps Environment Variables
# ============================================================
# Usage: bash scripts/set-env-backend.sh
# Prerequisites: az login && az account set --subscription <id>
#
# Fill in ALL values marked with <...> before running.
# ============================================================

RESOURCE_GROUP="<your-resource-group>"
CONTAINER_APP_NAME="<shura-backend-container-app-name>"

az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    NODE_ENV="production" \
    PORT="5001" \
    \
    DB_HOST="<your-db-host>" \
    DB_PORT="5432" \
    DB_NAME="shura" \
    DB_USER="<your-db-user>" \
    DB_PASSWORD="<your-db-password>" \
    \
    AUTH0_DOMAIN="auth.shura.life" \
    AUTH0_AUDIENCE="https://api.shura.life" \
    AUTH0_CLAIM_NAMESPACE="https://shura.com" \
    AUTH0_M2M_CLIENT_ID="<m2m-client-id>" \
    AUTH0_M2M_CLIENT_SECRET="<m2m-client-secret>" \
    AUTH0_ROLE_THERAPIST_ID="<rol_therapist-role-id>" \
    \
    CLOUD_NAME="<cloudinary-cloud-name>" \
    CLOUD_API_KEY="<cloudinary-api-key>" \
    CLOUD_API_SECRET="<cloudinary-api-secret>" \
    CLOUDINARY_UPLOAD_FOLDER="shura/uploads" \
    \
    RESEND_API_KEY="<resend-api-key>" \
    RESEND_FROM_EMAIL="<no-reply@your-verified-domain>" \
    RESEND_WEBHOOK_SECRET="<resend-webhook-signing-secret>" \
    ADMIN_EMAIL="<administrative-recipient>" \
    EMAIL_OUTBOX_WORKER_ENABLED="true" \
    \
    FRONTEND_URL="https://shura.life" \
    FRONTEND_URLS="https://shura.life" \
    ALLOWED_ORIGINS="https://shura.life" \
    \
    RAZORPAY_KEY_ID="<rzp_live_key>" \
    RAZORPAY_KEY_SECRET="<razorpay-secret>" \
    RAZORPAY_WEBHOOK_SECRET="<razorpay-webhook-secret>" \
    \
    APPLICATIONINSIGHTS_CONNECTION_STRING="<connection-string>" \
    \
    COOKIE_SAME_SITE="none" \
    JWT_SECRET="<generate-strong-random-string>"

echo "Backend env vars applied to: $CONTAINER_APP_NAME"
