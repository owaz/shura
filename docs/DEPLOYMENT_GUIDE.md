# Azure Container Apps — Step-by-Step Deployment Guide

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- An Azure subscription (Pay-As-You-Go or higher)
- Docker Desktop installed (for local testing)
- GitHub repo access to configure secrets

---

## Phase 1: Local Verification (15 min)

### 1.1 Test the Docker build locally

```bash
# From repo root
docker build -t shura-app .

# Run with a local PostgreSQL (or point to an existing one)
docker run -p 5001:5001 \
  -e NODE_ENV=production \
  -e PORT=5001 \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=postgres \
  -e DB_PASSWORD=yourpassword \
  -e DB_NAME=shura_production \
  -e JWT_SECRET=your-dev-secret-64-chars-minimum-xxxxxxxxxxxxxxxxxxxxxxxxxx \
  shura-app
```

### 1.2 Verify

```bash
# Health check
curl http://localhost:5001/api/health

# Frontend loads
# Open http://localhost:5001 in browser — should see the React app
```

---

## Phase 2: Provision Azure Resources (20 min)

### 2.1 Login and set variables

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "<your-subscription-id>"

# Define variables (customise these)
RESOURCE_GROUP="shura-rg"
LOCATION="centralindia"          # Choose closest region
ACR_NAME="shuraacr"              # Must be globally unique, lowercase, no hyphens
ACA_ENV="shura-env"
ACA_APP="shura-app"
PG_SERVER="shura-pg"
PG_ADMIN="shuraadmin"
PG_PASSWORD="$(openssl rand -base64 24)"  # Save this!
```

### 2.2 Create Resource Group

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### 2.3 Create Azure Container Registry (ACR)

```bash
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get credentials (you'll need these for GitHub secrets)
az acr credential show --name $ACR_NAME
# Note: username = $ACR_NAME, password = from output
```

### 2.4 Create Azure Database for PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $PG_SERVER \
  --location $LOCATION \
  --admin-user $PG_ADMIN \
  --admin-password "$PG_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --yes

# Create the database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $PG_SERVER \
  --database-name shura_production

# Allow Azure services to connect (required for Container Apps)
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $PG_SERVER \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 2.5 Create Container Apps Environment

```bash
az containerapp env create \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_ENV \
  --location $LOCATION
```

---

## Phase 3: Build & Deploy (15 min)

### 3.1 Build and push image to ACR

```bash
# Option A: Build locally and push
az acr login --name $ACR_NAME
docker build -t $ACR_NAME.azurecr.io/shura-app:v1 .
docker push $ACR_NAME.azurecr.io/shura-app:v1

# Option B: Build in the cloud (no local Docker needed)
az acr build \
  --registry $ACR_NAME \
  --image shura-app:v1 \
  --file Dockerfile .
```

### 3.2 Deploy Container App

```bash
# Generate a JWT secret
JWT_SECRET="$(openssl rand -base64 48)"

# Get PostgreSQL FQDN
PG_HOST=$(az postgres flexible-server show \
  --resource-group $RESOURCE_GROUP \
  --name $PG_SERVER \
  --query fullyQualifiedDomainName -o tsv)

# Create the Container App
az containerapp create \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --environment $ACA_ENV \
  --image $ACR_NAME.azurecr.io/shura-app:v1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)" \
  --target-port 5001 \
  --ingress external \
  --transport http \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --secrets \
    db-host="$PG_HOST" \
    db-user="$PG_ADMIN" \
    db-password="$PG_PASSWORD" \
    db-name="shura_production" \
    jwt-secret="$JWT_SECRET" \
  --env-vars \
    NODE_ENV=production \
    PORT=5001 \
    DB_HOST=secretref:db-host \
    DB_USER=secretref:db-user \
    DB_PASSWORD=secretref:db-password \
    DB_NAME=secretref:db-name \
    JWT_SECRET=secretref:jwt-secret
```

### 3.3 Get your app URL

```bash
az containerapp show \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --query properties.configuration.ingress.fqdn -o tsv
```

Your app will be live at `https://<app-name>.<region>.azurecontainerapps.io`

### 3.4 Verify deployment

```bash
APP_URL=$(az containerapp show --resource-group $RESOURCE_GROUP --name $ACA_APP --query properties.configuration.ingress.fqdn -o tsv)

# Health check
curl https://$APP_URL/api/health

# Open in browser — should show the frontend
echo "Open: https://$APP_URL"
```

---

## Phase 4: Configure CI/CD (15 min)

### 4.1 Create Azure Service Principal for GitHub Actions

```bash
# Create SP with Contributor role scoped to the resource group
az ad sp create-for-rbac \
  --name "github-shura-deploy" \
  --role Contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth
```

Copy the entire JSON output — this becomes `AZURE_CREDENTIALS` in GitHub.

### 4.2 Add GitHub Repository Secrets

Go to **GitHub repo > Settings > Secrets and variables > Actions** and add:

| Secret Name | Value |
|-------------|-------|
| `AZURE_CREDENTIALS` | Full JSON from step 4.1 |
| `ACR_USERNAME` | Your ACR name (e.g., `shuraacr`) |
| `ACR_PASSWORD` | Password from `az acr credential show` |

### 4.3 Create GitHub Environments

Go to **Settings > Environments** and create:

1. **`staging`** — no protection rules (auto-deploys)
2. **`production`** — add "Required reviewers" protection rule (manual approval)

### 4.4 Test the pipeline

```bash
git push origin main
```

The workflow will:
1. Build the Docker image
2. Push to ACR
3. Deploy to staging (automatic)
4. Deploy to production (after manual approval if configured)

---

## Phase 5: Production Hardening (Post-deploy)

### 5.1 Set minimum replicas to 1 (avoid cold starts)

```bash
az containerapp update \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --min-replicas 1
```

### 5.2 Add custom domain + TLS

```bash
# Add custom domain
az containerapp hostname add \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --hostname app.yoursite.com

# Bind managed certificate (free TLS)
az containerapp hostname bind \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --hostname app.yoursite.com \
  --environment $ACA_ENV \
  --validation-method CNAME
```

Before running this, add a CNAME record in your DNS:
```
app.yoursite.com  →  <app-name>.<region>.azurecontainerapps.io
```

### 5.3 Add remaining secrets (Cloudinary, Email, Razorpay)

```bash
az containerapp secret set \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --secrets \
    cloudinary-name="your-cloud-name" \
    cloudinary-key="your-api-key" \
    cloudinary-secret="your-api-secret" \
    email-user="your@gmail.com" \
    email-password="your-app-password"

# Then update env vars to reference them
az containerapp update \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --set-env-vars \
    CLOUD_NAME=secretref:cloudinary-name \
    CLOUD_API_KEY=secretref:cloudinary-key \
    CLOUD_API_SECRET=secretref:cloudinary-secret \
    EMAIL_USER=secretref:email-user \
    EMAIL_PASSWORD=secretref:email-password
```

For completeness, include Razorpay secrets and env mappings as shown below:

```bash
az containerapp secret set \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --secrets \
    razorpay-key-id="rzp_live_xxxxx" \
    razorpay-key-secret="your-razorpay-key-secret" \
    razorpay-webhook-secret="your-razorpay-webhook-secret"

az containerapp update \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --set-env-vars \
    RAZORPAY_KEY_ID=secretref:razorpay-key-id \
    RAZORPAY_KEY_SECRET=secretref:razorpay-key-secret \
    RAZORPAY_WEBHOOK_SECRET=secretref:razorpay-webhook-secret
```

`RAZORPAY_WEBHOOK_SECRET` must exactly match the secret configured in Razorpay Dashboard webhook settings.

### 5.4 Enable Azure Application Insights

```bash
# Create an Application Insights resource (workspace-based)
APPINSIGHTS_NAME="shura-ai"
LOG_ANALYTICS_NAME="shura-logs"

az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_ANALYTICS_NAME \
  --location $LOCATION

az monitor app-insights component create \
  --app $APPINSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --workspace $LOG_ANALYTICS_NAME

# Get connection string
APPINSIGHTS_CONN=$(az monitor app-insights component show \
  --app $APPINSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Set secret + env var on Container App
az containerapp secret set \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --secrets appinsights-conn="$APPINSIGHTS_CONN"

az containerapp update \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP \
  --set-env-vars APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:appinsights-conn
```

### 5.5 Initialize database schema

```bash
# Connect to PostgreSQL and run your schema
az postgres flexible-server connect \
  --name $PG_SERVER \
  --admin-user $PG_ADMIN \
  --admin-password "$PG_PASSWORD" \
  --database-name shura_production

# Or use psql locally:
psql "host=$PG_HOST dbname=shura_production user=$PG_ADMIN password=$PG_PASSWORD sslmode=require" \
  -f shura-backend/production_schema.sql
```

---

## Phase 6: Staging Environment (Optional)

```bash
# Create a separate staging app in the same environment
az containerapp create \
  --resource-group $RESOURCE_GROUP \
  --name $ACA_APP-staging \
  --environment $ACA_ENV \
  --image $ACR_NAME.azurecr.io/shura-app:v1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)" \
  --target-port 5001 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 2 \
  --cpu 0.25 \
  --memory 0.5Gi \
  --secrets \
    db-host="$PG_HOST" \
    db-user="$PG_ADMIN" \
    db-password="$PG_PASSWORD" \
    db-name="shura_staging" \
    jwt-secret="staging-secret-change-me" \
  --env-vars \
    NODE_ENV=production \
    PORT=5001 \
    DB_HOST=secretref:db-host \
    DB_USER=secretref:db-user \
    DB_PASSWORD=secretref:db-password \
    DB_NAME=secretref:db-name \
    JWT_SECRET=secretref:jwt-secret
```

---

## Quick Reference: Useful Commands

| Task | Command |
|------|---------|
| View logs | `az containerapp logs show -g $RESOURCE_GROUP -n $ACA_APP --follow` |
| Check replicas | `az containerapp replica list -g $RESOURCE_GROUP -n $ACA_APP` |
| Rollback | `az containerapp update -g $RESOURCE_GROUP -n $ACA_APP --image $ACR_NAME.azurecr.io/shura-app:<previous-tag>` |
| Scale manually | `az containerapp update -g $RESOURCE_GROUP -n $ACA_APP --min-replicas 2 --max-replicas 10` |
| View revisions | `az containerapp revision list -g $RESOURCE_GROUP -n $ACA_APP -o table` |
| Restart | `az containerapp revision restart -g $RESOURCE_GROUP -n $ACA_APP --revision <name>` |

---

## Cost Summary

| Resource | Monthly Cost |
|----------|-------------|
| Container App (0.5 vCPU, 1 GiB, scale-to-zero) | ~$15-30 |
| Container Registry (Basic) | ~$5 |
| PostgreSQL Flexible (B1ms) | ~$13 |
| **Total** | **~$33-48/mo** |

---

## Checklist

- [ ] Phase 1: Local Docker build works
- [ ] Phase 2: Azure resources provisioned
- [ ] Phase 3: First deployment successful
- [ ] Phase 4: CI/CD pipeline active
- [ ] Phase 5: Custom domain + secrets configured
- [ ] Phase 5: Database schema initialized
- [ ] Phase 6: Staging environment ready
