# Production Email Configuration Inventory

**Phase 0 Gate 5: Inventory live operational state**

## Summary

This document captures the current production email configuration state and identifies critical gaps that must be resolved before Resend migration.

**Status**: INCOMPLETE — Cannot verify production state from repository alone. Requires access to Azure portal and production logs.

---

## Expected Production Variables

Based on code audit of `shura-backend/utils/emailService.js`:

| Variable | Purpose | Type | Current Source |
|----------|---------|------|-----------------|
| `EMAIL_USER` | Gmail account email (sender identity) | String | Unknown |
| `EMAIL_PASSWORD` | Gmail app password | String (16 chars, no spaces) | Unknown |
| `ADMIN_EMAIL` | Admin recipient for intake/approval notifications | String | Unknown |

### Code Usage

- **From address**: `process.env.EMAIL_USER` (all emails)
- **SMTP credentials**: `process.env.EMAIL_USER` + `process.env.EMAIL_PASSWORD`
- **Admin notifications**: `process.env.ADMIN_EMAIL` (intake submissions, therapist applications, approvals)

---

## GitHub Actions Deployment Pipeline

**File**: `.github/workflows/deploy-aca.yml`

### Build Stage
- Frontend build args: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_API_URL`, `VITE_WS_URL`
- **Email env vars**: NONE injected
- **Finding**: Email secrets are NOT passed as build-time arguments

### Deployment Stage (Staging & Production)
- Uses `azure/container-apps-deploy-action@v2`
- **Email env vars in workflow**: NONE found (grep search returned no matches)
- **Finding**: Email secrets are NOT set via GitHub Actions workflow

### Conclusion
Email credentials must be configured outside the GitHub Actions workflow, either:
1. **Azure Key Vault** (likely, if using managed identity)
2. **Azure Container Apps environment variables** (manually set via portal)
3. **Docker environment** (set at container runtime via portal)
4. **Not configured** (email functionality broken in production)

---

## Docker Image Configuration

**File**: `Dockerfile`

### Hardcoded Values
- `NODE_ENV=production`
- `PORT=5001`

### Expected Runtime Environment
- Email variables (`EMAIL_*`, `ADMIN_EMAIL`) are NOT baked into image
- Must be injected at Azure Container Apps deployment time
- No reference to secrets or key vault in Dockerfile

### Conclusion
Email configuration is external to Docker image and must be provided at runtime.

---

## What We Know

### ✓ Confirmed
- Application code expects `EMAIL_USER`, `EMAIL_PASSWORD`, `ADMIN_EMAIL` environment variables
- SMTP provider: Gmail (hardcoded in emailService.js)
- Session name: `'gmail'` (line 42, emailService.js)
- SMTP host: `'smtp.gmail.com'` (line 40, emailService.js)
- SMTP port: `465` (line 41, emailService.js, secure connection)

### ✗ Not Confirmed
- Whether production has these variables configured
- Current Gmail account email address
- Current admin recipient email address
- Sending domain (if using custom domain vs. Gmail's domain)
- Gmail account age, reputation, or throughput capacity
- Monthly send volume and peaks
- Bounce rate, unsubscribe rate, or spam complaints
- Whether credentials are in Azure Key Vault or Container Apps secrets
- Whether email is actually working in production

---

## Critical Gaps to Resolve

Before proceeding with Resend migration, must obtain:

### 1. Production Verification
- [ ] Confirm email is currently working in production (send test email)
- [ ] Verify `EMAIL_USER`, `EMAIL_PASSWORD`, `ADMIN_EMAIL` are set in Azure
- [ ] Check where these are stored (Key Vault vs. Container App secrets vs. other)
- [ ] Measure current email delivery SLA and error rate

### 2. Gmail Account Details
- [ ] What Gmail account is currently being used?
- [ ] When was it created?
- [ ] Is it a personal account or GSuite/Workspace account?
- [ ] What is the IP reputation and spam score?
- [ ] Are any forwarding rules active (e.g., forwarding to another address)?

### 3. Sending Domain
- [ ] Is email being sent from `gmail.com` address or custom domain?
- [ ] If custom domain: who owns the DNS?
- [ ] Does the domain have SPF, DKIM, DMARC records?
- [ ] What is the domain's age and reputation?

### 4. Volume and SLA
- [ ] Current monthly send volume (estimate or actual metrics)
- [ ] Send volume peak (daily max, monthly max)
- [ ] Required delivery SLA (e.g., 99% within 5 minutes, 100% same-day)
- [ ] Are there backup/fallback email providers?

### 5. Operational Metrics
- [ ] Current bounce rate (% of emails that fail)
- [ ] Unsubscribe rate (if any unsubscribe links exist)
- [ ] Spam complaint rate (user reports as spam)
- [ ] Any SMTP authentication failures or rate-limit hits in logs?

### 6. Regulatory Requirements
- [ ] Is this application subject to HIPAA?
- [ ] Is a Business Associate Agreement (BAA) required?
- [ ] Data residency: must data be kept in a specific country/region?
- [ ] Retention policy: how long should email logs be kept?

---

## Resend Readiness Checklist

Once above gaps are resolved, can confirm:

- [ ] Production email volume is within Resend's free tier OR pricing is acceptable
- [ ] Domain reputation can be migrated to Resend (SPF/DKIM/DMARC reconfiguration)
- [ ] Data residency and HIPAA requirements are compatible with Resend's US-based infrastructure
- [ ] Sending domain ownership can be verified in Resend
- [ ] All Azure secrets can be updated with Resend API key

---

## Immediate Actionable Steps

### For Operations/DevOps Team
1. Verify production email configuration is actually set up and working
2. Document where `EMAIL_USER`, `EMAIL_PASSWORD`, `ADMIN_EMAIL` are stored
3. Measure current monthly send volume and per-day peaks
4. Confirm sending domain ownership and DNS records
5. Provide details on Gmail account age, reputation, and any restrictions

### For Legal/Compliance Team
1. Confirm whether application handles Protected Health Information (PHI)
2. Determine if HIPAA/BAA is a requirement for email service
3. Document any data residency requirements
4. Clarify email retention policy and compliance needs

### For Product Team
1. Confirm whether email delivery SLA is critical to business
2. Decide if reminder emails (24h, 1h) should be added before/after Resend migration
3. Review optional emails (booking confirmation) and decide on preference defaults

---

## Known Azure Container Apps Configuration Points

These are the locations where EMAIL_* variables would need to be set:

1. **Azure Container Apps → Environment Variables**
   - Runtime environment variables visible to running container
   - Can reference Key Vault secrets

2. **Azure Key Vault** (if using managed identity)
   - Secure storage for `EMAIL_PASSWORD` and potentially `EMAIL_USER`
   - Safer than storing in plain Container Apps variables

3. **Container Apps Secrets** (alternative to Key Vault)
   - Per-deployment secret storage
   - Less ideal than Key Vault for long-term security

---

## Migration Decision Tree

```
Is email currently working in production?
├─ Yes → Proceed to measure volume and SLA requirements
│   ├─ Is HIPAA/BAA required?
│   │   ├─ Yes → Verify Resend HIPAA eligibility before proceeding
│   │   └─ No → Proceed to Phase 1
│   └─ Measure volume and identify domain configuration
│
└─ No → Email is not configured in production
    ├─ Resolve production configuration FIRST
    └─ Only then begin Resend migration
```

---

## Next Actions

This inventory is **BLOCKED** on:
1. Access to Azure portal to verify current configuration
2. Production logs or metrics to confirm email is working
3. Business requirements (volume, SLA, regulatory) from stakeholders

**Assigned to**: [Devops/Operations team]
**Target completion**: [TO BE FILLED]

---

## Related Phase 0 Gates

- Gate 1: ✅ Stop emailing sensitive intake data (COMPLETE)
- Gate 2: ⏳ Legal/privacy review (PENDING external input)
- Gate 3: ✅ Classify messages as mandatory vs. optional (COMPLETE)
- Gate 4: ✅ Define message classification (COMPLETE)
- Gate 5: ⏳ Inventory production state (THIS DOCUMENT - BLOCKED on Azure access)

