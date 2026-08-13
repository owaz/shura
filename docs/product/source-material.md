# Product source material

## Status

The repository includes Word research documents and visual references created before or alongside implementation. They help explain product intent, but they are not automatically accepted requirements, clinical guidance, pricing policy, or evidence.

### `WORD/An Islamic Psychology Consultation Website can have a profou.docx`

Explores the social value of faith-sensitive mental-health support: reducing stigma, bridging faith and therapy, strengthening families/community, accessibility, preventive education, spiritual growth, and practitioner collaboration. It also proposes crisis and Ruqya-related capabilities that the application does not currently operate or validate.

### `WORD/Islamic psyc consultation web.docx`

Catalogues historic scholars, possible practitioner specializations, client categories, and faith-integrated therapy approaches. Treat these classifications as research notes. The repository does not verify credentials, clinical scope, cited evidence, or regulatory suitability.

### `WORD/Major psych disorders in Muslims (india).docx`

Lists disorders, cultural barriers, language/access concerns, and potential platform features for Indian Muslim communities. Some content concerns suicide, abuse, diagnosis, and spiritual interpretations. It requires qualified clinical, safeguarding, legal, and theological review before being used as user-facing guidance or triage logic.

### `WORD/PRICING STRUCTURE FOR IP CONSULTATION WEBSITE.docx`

Proposes INR ranges, session-length multipliers, packages, sliding scale, pay-as-you-can/pro-bono options, surcharges, and cancellation/refund ideas. Current code implements therapist rates, Razorpay INR payments, and configurable 24-hour cancellation/refund policy only. The remaining proposals are not accepted business rules.

### `WORD/THERAPY TECHNIQUES USED FOR VARIOUS CLIENTS.docx`

Lists therapy modalities, specialties, and broad client suitability. It is not encoded as a validated taxonomy and should not drive automated clinical matching without professional governance.

## Visual references

`therapists page.jpg` and `THERAPISTS PAGE FINAL/` are visual/design references. `shura-frontend/public/images/` contains runtime brand/media assets. Preserve licenses/provenance when replacing or publishing assets; the repository does not contain a complete asset-license register.

## Usage rule

When product research and implementation differ:

1. describe current behavior from implementation
2. label research as proposed or uncertain
3. obtain appropriate product/clinical/legal/security approval before adoption
4. record accepted durable rules in `docs/product` and significant architecture decisions in an ADR
