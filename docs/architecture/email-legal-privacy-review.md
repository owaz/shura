# Legal and Privacy Review Checklist

**Phase 0 Gate 2: Legal/Privacy Review**

This checklist captures critical legal and privacy decisions that must be made before adopting Resend as the email service provider.

**Assigned to**: Legal team, Privacy officer, Compliance team
**Status**: PENDING INPUT - **BLOCKS** Phase 1 implementation until completed

---

## Part 1: HIPAA and Healthcare Compliance

### Question 1: Is this application subject to HIPAA?

**Background**: HIPAA (Health Insurance Portability and Accountability Act) applies to "covered entities" and "business associates" that handle protected health information (PHI).

**Scope of Application**:
- Does the application collect, store, or transmit mental health information? [ ] Yes [ ] No
  - Examples: Therapy notes, diagnosis, suicidality screening, trauma history, medications
- Will therapists use this platform as part of clinical practice? [ ] Yes [ ] No
- Are clients/patients expecting HIPAA privacy protections? [ ] Yes [ ] No
- Is the organization a licensed healthcare provider or covered entity? [ ] Yes [ ] No

### Question 2: If HIPAA applies, is a Business Associate Agreement (BAA) required?

**Key Finding**: Resend's public documentation does NOT mention HIPAA support or BAA availability.

- [ ] Legal opinion: HIPAA applies to our organization and our handling of email
- [ ] Therefore: BAA required from email service provider
- [ ] Action required: **Contact Resend sales** to:
  - Confirm HIPAA BAA is available
  - Confirm US data residency meets requirement
  - Obtain signed BAA before proceeding
  - Document any limitations or exclusions

### Question 3: Alternative if Resend BAA unavailable

If Resend does NOT offer HIPAA BAA:
- [ ] Reject Resend; recommend HIPAA-certified alternative (e.g., SendGrid with BAA, AWS SES with BAA wrapper)
- [ ] Redact sensitive health data before sending email (already done: Phase 0 fix)
- [ ] Use alternative transport (e.g., in-app notifications only, no email)
- [ ] Other: __________

**Recommendation**: Do NOT proceed to Phase 1 without confirmed HIPAA BAA availability (if applicable).

---

## Part 2: Data Residency and Localization

### Question 4: Does data localization apply?

**Background**: Resend explicitly documents that **account data and logs are stored in the US**, regardless of where emails are sent from.

**Scope**:
- [ ] Is organization subject to GDPR (EU-based or EU customers)? [ ] Yes [ ] No
- [ ] Is organization subject to country-specific data localization law?
  - If yes, which country: __________
  - Which data must stay in that country: __________
- [ ] Is organization subject to data transfer restrictions?
  - [ ] Cannot transfer data outside [country]
  - [ ] Cannot transfer data without adequacy determination
  - [ ] Other: __________

### Question 5: Resend's US-based data storage

**Key Finding**: Resend stores:
- Account metadata (credentials, configuration)
- Email logs (bounce reports, delivery events)
- Webhook logs
- All other transactional data

**In**: US data centers

**Even when**: Emails are sent from EU, APAC, or other regions

**Implication for GDPR**:
- If operating in EU or serving EU customers, must ensure data transfer is lawful
- Resend provides Standard Contractual Clauses (SCCs) per GDPR Article 46
- SCCs are accepted legal basis but not all data transfers need SCCs
- Email content (message body) is NOT stored (lower risk)
- Metadata (timestamps, recipient, status) IS stored in US (requires legal analysis)

### Question 6: Compliance with data residency requirements

- [ ] Organization can accept US data residency for account metadata and logs
- [ ] Legal analysis confirms SCCs are sufficient for GDPR compliance (if EU)
- [ ] Explicit business decision: benefits of Resend outweigh data transfer risks
- [ ] Alternative decision: reject Resend; require EU data center provider

**If localization CANNOT be accepted**:
- Recommend: SendGrid with EU data center, AWS SES with EU wrapper, or other regional provider
- Action: Escalate to executive sponsor

---

## Part 3: Data Retention and Deletion Rights

### Question 7: How long must email data be retained?

**Current state**: Unknown; no retention policy documented.

- [ ] Email must be retained for: __________ (days/months/years)
- [ ] Rationale/regulation:
  - [ ] Tax compliance (e.g., 7 years for audit trail)
  - [ ] Healthcare documentation (e.g., HIPAA 6 years)
  - [ ] Litigation hold (e.g., 3 years)
  - [ ] Other: __________
- [ ] Who is responsible for deletion after retention window? __________

### Question 8: User right to deletion (GDPR Article 17)

If operating under GDPR:
- [ ] Users have right to request deletion of their email history? [ ] Yes [ ] No
- [ ] Timeline to comply with deletion request: __________ (days)
- [ ] Can email logs be deleted while preserving audit trail? [ ] Yes [ ] No
- [ ] Process for deletion:
  - [ ] Manual deletion request to Resend support
  - [ ] API-based deletion
  - [ ] Automated data subject access request (DSAR) workflow
  - [ ] Other: __________

**Action**: Document data deletion process; ensure Resend supports it.

---

## Part 4: Email Content and Data Privacy

### Question 9: What sensitive data should NOT be in email?

**Current fix** (Phase 0): Removed full intake form from admin notification.

**Remaining risk**: Other emails may contain sensitive information.

- [ ] Therapist session booking confirmation contains therapist identity
  - Acceptable risk? [ ] Yes [ ] No
  - If no, alternatives: __________
- [ ] Session rescheduled/cancelled contains both parties' identities and schedule
  - Acceptable risk? [ ] Yes [ ] No
  - If no, alternatives: __________
- [ ] Other emails reviewed for sensitive content? [ ] Yes [ ] No

**Action**: Audit all email templates; document why each field is necessary; redact if not needed.

### Question 10: Email encryption in transit and at rest

- [ ] Must email be encrypted in transit (TLS)? [ ] Yes [ ] No
  - Resend supports SMTP over TLS ✓
  - Resend HTTP API uses HTTPS ✓
- [ ] Must email be encrypted at rest in Resend's systems? [ ] Yes [ ] No
  - Resend public docs do NOT document encryption at rest
  - **Action**: Request encryption-at-rest documentation from Resend

---

## Part 5: Unsubscribe and Preference Management

### Question 11: Do users need an unsubscribe option?

**Current state**: No unsubscribe links in emails; no preference mechanism for operational emails.

- [ ] Mandatory emails (therapist approval, booking confirmation) should have unsubscribe? [ ] Yes [ ] No
- [ ] Optional emails (reminders) should have unsubscribe? [ ] Yes [ ] No
- [ ] If unsubscribe offered: What happens when user unsubscribes?
  - [ ] Mark user preference in database (respect in future sends)
  - [ ] Remove user from mailing list (prevent all future sends)
  - [ ] Alert ops team for manual review
  - [ ] Other: __________

**Recommendation**: Unsubscribe only for optional/preference-controlled emails, not operational emails.

---

## Part 6: Consent and Notification

### Question 12: Do clients consent to receive emails?

**Current state**: No explicit consent collection; intake form doesn't ask.

- [ ] Should consent be collected during signup? [ ] Yes [ ] No
- [ ] Should consent be collected per email type?
  - [ ] Booking confirmation (mandatory or optional)
  - [ ] Session reminders (mandatory or optional)
  - [ ] Other: __________
- [ ] Should privacy policy be updated to describe email handling?
  - [ ] What data is sent in email?
  - [ ] How long is it retained?
  - [ ] Who can access it?
  - [ ] How is it deleted?

**Action**: Update privacy policy and obtain explicit consent if required by law.

---

## Part 7: Third-Party Data Processing

### Question 13: Vendor assessment for Resend

**Background**: Sending email to Resend means Resend becomes a data processor (GDPR) or business associate (HIPAA).

- [ ] Resend Data Processing Agreement (DPA) has been reviewed [ ] Yes [ ] No
- [ ] Resend DPA covers all required topics:
  - [ ] Data processing scope (what data, what processing)
  - [ ] Security safeguards (encryption, access controls)
  - [ ] Subprocessors (does Resend use other vendors?)
  - [ ] Data subject rights (deletion, access, portability)
  - [ ] Breach notification (timeline and process)
- [ ] Resend security posture acceptable?
  - [ ] SOC 2 Type II certified? ✓ (Confirmed)
  - [ ] ISO 27001 certified? ✓ (Confirmed)
  - [ ] Penetration testing performed? (Request evidence)
  - [ ] Incident response process documented? (Request process)

**Action**: Request and review Resend DPA and security assessment documentation.

### Question 14: Subprocessor compliance

- [ ] Resend subprocessors:
  - Does Resend use AWS/Azure/Google Cloud? [ ] Yes [ ] No
  - Does Resend use third-party analytics? [ ] Yes [ ] No
  - Does Resend use third-party security tools? [ ] Yes [ ] No
- [ ] Are all subprocessors acceptable and documented? [ ] Yes [ ] No
- [ ] Does Resend provide list of subprocessors? [ ] Yes [ ] No
- [ ] Is there a process to review/approve changes to subprocessor list? [ ] Yes [ ] No

---

## Part 8: Breach Notification and Liability

### Question 15: Incident response and notification

- [ ] If Resend experiences a data breach:
  - [ ] Notification timeline (how many hours/days)?
  - [ ] Who is notified (your organization, customers)?
  - [ ] What information is provided (scope, impact, remediation)?
  - [ ] Who bears liability (Resend or your organization)?

**Action**: Document breach notification requirements in contract/DPA.

### Question 16: Liability and indemnification

- [ ] If Resend fails to deliver emails:
  - [ ] Is there a liability cap? (Often limited in SaaS contracts)
  - [ ] Can Resend be held liable for consequential damages?
  - [ ] What is the remedy (credits, refund, termination)?
- [ ] If Resend is compromised and client data is exposed:
  - [ ] Who is liable to the client (Resend or your organization)?
  - [ ] Is insurance required?
  - [ ] Is indemnification clause in place?

**Action**: Review SaaS terms; consider cyber liability insurance.

---

## Part 9: Regulatory Compliance Summary

### Compliance Checklist

Based on all answers above, confirm:

#### HIPAA (if applicable)
- [ ] Resend HIPAA BAA obtained or confirmed available
- [ ] BAA covers all required safeguards (encryption, audit logs, deletion)
- [ ] Email content redacted of sensitive health data (Phase 0 fix complete)
- [ ] Business associate obligations understood

#### GDPR (if EU-based or serving EU customers)
- [ ] Data transfer basis documented (SCCs or other)
- [ ] Data retention policy documented (how long to keep email logs)
- [ ] User deletion rights implemented (DSAR process)
- [ ] Subprocessors reviewed and acceptable
- [ ] DPA signed with Resend

#### Other Regulations
- [ ] CCPA compliance verified (Resend compliant ✓)
- [ ] GLBA/Financial Services: __________ (if applicable)
- [ ] COPPA/Children: __________ (if applicable)
- [ ] Other: __________ (if applicable)

---

## Part 10: Final Sign-Off

### Legal Review Approval

- [ ] All questions above have been answered
- [ ] All regulatory and compliance requirements have been met or mitigated
- [ ] Resend has been approved as email service provider OR
- [ ] Resend has been REJECTED; alternative provider recommended:
  - Recommended alternative: __________
  - Reason: __________

### Stakeholder Sign-Off

- [ ] Legal review completed by: __________ Date: __________
- [ ] Reviewed by Privacy Officer: __________ Date: __________
- [ ] Approved by General Counsel / Compliance Officer: __________ Date: __________
- [ ] Executive Sponsor (if major risk identified): __________ Date: __________

---

## Blocking Risks

If any of the following are found, Phase 1 implementation is **BLOCKED** until resolved:

1. **HIPAA applies but Resend BAA unavailable**
   - Status: [ ] RESOLVED [ ] BLOCKED
   - Action: __________

2. **Data residency required but Resend US-only storage unacceptable**
   - Status: [ ] RESOLVED [ ] BLOCKED
   - Action: __________

3. **GDPR data transfer legality unconfirmed**
   - Status: [ ] RESOLVED [ ] BLOCKED
   - Action: __________

4. **Resend DPA unacceptable**
   - Status: [ ] RESOLVED [ ] BLOCKED
   - Action: __________

---

## Next Steps

### If All Boxes Checked & Approved
Proceed to Phase 1 implementation with:
- Signed DPA / BAA with Resend
- Documented compliance justification
- Email template audit (sensitive data redaction)

### If Blocking Risks Identified
Options:
1. Escalate to executive sponsor for risk acceptance
2. Select alternative provider meeting requirements
3. Defer Resend adoption pending resolution (stay on Gmail)
4. Modify scope (e.g., non-health emails to Resend; health emails via alternative)

---

## Related Documents

- `docs/architecture/email-resend-feasibility.md` - Full feasibility analysis
- `docs/architecture/email-classification.md` - Email types and criticality
- `docs/architecture/email-production-inventory.md` - Current production state
- `docs/architecture/email-volume-sla-worksheet.md` - Volume and SLA requirements

