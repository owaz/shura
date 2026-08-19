# Email Volume and SLA Requirements Worksheet

**Phase 0 Gate 4: Measure email volume and SLA requirements**

This worksheet captures business requirements for email delivery that must be understood before implementing Resend.

**Assigned to**: Ops team, Product team, Stakeholders
**Status**: PENDING INPUT

---

## Email Volume Measurement

### Current Production Volume

**Instruction**: Obtain metrics from production logs or Gmail account (Gmail Admin Console if GSuite/Workspace).

#### Monthly Send Volume
- [ ] Monthly total emails sent: __________ (est. or actual)
- [ ] Source of data: __________ (logs, Gmail dashboard, metrics, estimate)
- [ ] Measurement period: __________ (date range)
- [ ] Average per day: __________ (monthly ÷ days)
- [ ] Peak day volume: __________ (single highest day in period)

#### Send Volume by Email Type
Use the email classification from `docs/architecture/email-classification.md` to break down volume:

| Email Type | Estimated Monthly | Notes |
|-----------|------------------|-------|
| Therapist application | ___ | (Admin notification) |
| Therapist approval | ___ | (Sent to therapist) |
| Client questionnaire | ___ | (Admin notification) |
| Intake form link | ___ | (Sent to client) |
| Intake form submission | ___ | (Admin notification) |
| Booking confirmation (client) | ___ | (Sent to client) |
| Booking confirmation (therapist) | ___ | (Sent to therapist) |
| Session rescheduled | ___ | (Sent to both parties) |
| Session cancelled | ___ | (Sent to both parties) |
| Therapist released | ___ | (Sent to therapist) |
| **Session reminders** (24h) | ___ | (NOT YET IMPLEMENTED) |
| **Session reminders** (1h) | ___ | (NOT YET IMPLEMENTED) |
| **Other** | ___ | (Describe) |

#### Spike Analysis
- [ ] Busiest hour of day: __________ (time range)
- [ ] Busiest day of week: __________ (day name)
- [ ] Busiest period of month: __________ (date range or event)
- [ ] Highest single-hour volume: __________ emails (peaks)
- [ ] Is volume seasonal? [ ] Yes [ ] No (e.g., New Year's resolutions, academic calendar)

### Current Gmail Account Health

#### Account Metrics
- [ ] Gmail account creation date: __________ (age relevant for reputation)
- [ ] Current sending reputation: __________ (Green/Yellow/Red from Gmail dashboard)
- [ ] Bounce rate: __________%
- [ ] Complaint rate: __________%
- [ ] Unsubscribe rate: __________%
- [ ] Authentication status:
  - [ ] SPF: passing / failing / not configured
  - [ ] DKIM: passing / failing / not configured
  - [ ] DMARC: passing / failing / not configured

#### Rate Limits & Throttling
- [ ] Ever hit Gmail rate limits? [ ] Yes [ ] No
  - If yes, describe: __________
- [ ] Ever receive authentication failures? [ ] Yes [ ] No
  - If yes, describe: __________
- [ ] Ever receive timeout/delay errors? [ ] Yes [ ] No
  - If yes, describe: __________

---

## Service Level Agreement (SLA) Requirements

### Business Requirements

**Instruction**: Define what delivery guarantees are needed for email to be considered "successful" for the business.

#### Delivery Guarantees
- [ ] Must reach inbox within: __________ minutes (e.g., 5, 15, 60 minutes)
- [ ] Acceptable failure rate: __________%
  - Example: "98% success" = 2% tolerable failure
- [ ] Acceptable "unknown" delivery status: __________%
  - Example: "bounces not reported back" = OK / not acceptable
- [ ] Required retry window: __________ hours (how long to retry before giving up)

#### Criticality by Email Type

| Email Type | Criticality | SLA Requirement | Notes |
|-----------|-----------|-----------------|-------|
| Therapist application | Critical / Important / Nice-to-have | ___ | |
| Therapist approval | Critical / Important / Nice-to-have | ___ | |
| Client questionnaire | Critical / Important / Nice-to-have | ___ | |
| Intake form link | **CRITICAL** | Same-day delivery | Time-sensitive; client cannot begin intake without this |
| Intake form submission | Critical / Important / Nice-to-have | ___ | |
| Booking confirmation (client) | **CRITICAL** | Within 1 hour | Client needs proof of booking |
| Booking confirmation (therapist) | Critical / Important / Nice-to-have | ___ | |
| Session rescheduled | Critical / Important / Nice-to-have | ___ | |
| Session cancelled | Critical / Important / Nice-to-have | ___ | |
| Therapist released | Important / Nice-to-have | ___ | |
| Session reminders (24h) | Optional | Non-time-critical | Can be batched |
| Session reminders (1h) | Optional | Non-time-critical | Can be batched |

#### Bounce & Unsubscribe Handling
- [ ] How should bounced/undeliverable emails be handled?
  - [ ] Log and alert (escalate to support)
  - [ ] Update user email address (store in CRM)
  - [ ] Disable user account
  - [ ] Other: __________
- [ ] Are there unsubscribe links in any emails? [ ] Yes [ ] No
  - If yes, how many users have unsubscribed?
  - [ ] Are there unsubscribe preferences to respect? [ ] Yes [ ] No

#### Alerting & Observability
- [ ] Should failures trigger alerts to Ops team? [ ] Yes [ ] No
- [ ] What failure threshold triggers alert? __________
- [ ] Who receives alerts? __________ (email, Slack, PagerDuty, etc.)
- [ ] Is audit trail of all sends required? [ ] Yes [ ] No
- [ ] Is webhook delivery confirmation required? [ ] Yes [ ] No

---

## Resend Pricing & Free Tier Feasibility

### Resend Pricing Model
- **Free tier**: 100 emails/day (3,000/month)
- **Paid tier**: $20/month for up to 50,000/month

### Your Current Volume
- [ ] Current monthly volume: __________ (from section above)
- [ ] Fits in free tier? [ ] Yes (≤3,000/mo) [ ] No (>3,000/mo)
- [ ] Fits in first paid tier? [ ] Yes (≤50,000/mo) [ ] No (>50,000/mo)

### Cost-Benefit Analysis
- [ ] Current Gmail solution cost: $__________ (if any; often free personal account)
- [ ] Resend cost for your volume: $__________ (estimate)
- [ ] Cost increase acceptable? [ ] Yes [ ] No
- [ ] Are there other Resend features worth paying for?
  - [ ] Email templates
  - [ ] Webhook events
  - [ ] Better deliverability (reputation management)
  - [ ] Audit logs / compliance reporting
  - [ ] Other: __________

---

## Data Residency & Compliance

### Regulatory Requirements

**Instruction**: Clarify what compliance framework applies to this data.

#### Protected Health Information (PHI)
- [ ] Does application handle PHI (Protected Health Information)? [ ] Yes [ ] No
  - If yes: Describe what PHI is collected:
    - [ ] Mental health diagnosis/treatment notes
    - [ ] Medications
    - [ ] Medical history
    - [ ] Therapy session content
    - [ ] Other: __________

- [ ] Is HIPAA compliance required? [ ] Yes [ ] No [ ] Unsure
  - If yes, Business Associate Agreement (BAA) is **REQUIRED**
  - Note: Resend's public docs do NOT mention HIPAA BAA availability

#### Data Residency
- [ ] Is data localization a requirement? [ ] Yes [ ] No
  - If yes, where must data be stored?
    - [ ] United States only
    - [ ] Europe (GDPR compliance)
    - [ ] Specific country: __________
    - [ ] Any jurisdiction except: __________
  - Resend explicitly stores account data in US region regardless of sending region

#### Compliance Frameworks
- [ ] SOC 2 Type II required? [ ] Yes [ ] No (Resend has this ✓)
- [ ] ISO 27001 required? [ ] Yes [ ] No (Resend has this ✓)
- [ ] GDPR compliance required? [ ] Yes [ ] No (Resend compliant, but see data residency above)
- [ ] CCPA compliance required? [ ] Yes [ ] No (Resend compliant)
- [ ] Industry-specific compliance?
  - [ ] Financial services (PCI-DSS)
  - [ ] Healthcare (HIPAA)
  - [ ] Education (FERPA)
  - [ ] Other: __________

#### Data Retention & Deletion
- [ ] How long must email records be kept? __________ (days/months/years)
- [ ] Must audit logs be retained separately? [ ] Yes [ ] No
- [ ] Can user request deletion of email history? [ ] Yes [ ] No
- [ ] Is email content encryption at rest required? [ ] Yes [ ] No

---

## Stakeholder Checklist

### Operations Team
- [ ] Verified current monthly send volume
- [ ] Confirmed Gmail account health metrics
- [ ] Documented authentication (SPF/DKIM/DMARC) status
- [ ] Identified any rate-limit or delivery issues
- [ ] Provided access to Azure portal for email config verification

### Product Team
- [ ] Defined criticality of each email type
- [ ] Confirmed SLA requirements for time-sensitive emails
- [ ] Decided on reminder email implementation (24h, 1h)
- [ ] Defined bounce/unsubscribe handling strategy

### Legal/Compliance Team
- [ ] Confirmed whether application handles PHI
- [ ] Determined HIPAA BAA requirement
- [ ] Clarified data residency constraints
- [ ] Specified email retention and deletion policies

### Finance/Business
- [ ] Approved Resend pricing for current volume
- [ ] Authorized Azure Key Vault or container app secret updates
- [ ] Confirmed domain ownership and DNS access

---

## Sign-Off

When all fields are complete and reviewed, stakeholders should sign off:

### Operations Verification
- [ ] Completed by: __________ Date: __________
- [ ] Reviewed by: __________ Date: __________

### Product Sign-Off
- [ ] Approved by: __________ Date: __________

### Legal/Compliance Sign-Off
- [ ] Approved by: __________ Date: __________

### Executive Sponsor (if HIPAA/Data Residency blockers identified)
- [ ] Approved by: __________ Date: __________

---

## Next Steps

Once this worksheet is completed:

1. **If volume ≤ 3,000/month**: Consider free tier trial; no pricing concern
2. **If 3,000 < volume ≤ 50,000/month**: Resend first paid tier ($20/mo); proceed
3. **If volume > 50,000/month**: Negotiate Resend volume pricing or compare alternatives
4. **If HIPAA required**: Verify Resend BAA availability with sales before proceeding
5. **If data residency required**: Confirm Resend meets localization requirement or reject
6. **If compliance gaps found**: Escalate to legal/security team; may block Resend adoption

---

## Related Documents

- `docs/architecture/email-resend-feasibility.md` - Feasibility analysis and decision gates
- `docs/architecture/email-classification.md` - Email type classification and criticality
- `docs/architecture/email-production-inventory.md` - Current production configuration audit

