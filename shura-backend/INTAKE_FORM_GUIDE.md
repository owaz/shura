# Legacy: Client intake-form system guide

> **Legacy workflow/API guide.** It contains older URLs, request examples, and implementation assumptions. Use [`../docs/product/workflows.md`](../docs/product/workflows.md), [`../docs/architecture/authentication-and-security.md`](../docs/architecture/authentication-and-security.md), and current intake route code. Intake tokens and responses are sensitive authorization/clinical data.

## Overview
The intake form system sends clients a single-use link through the durable email outbox. Completed responses remain in PostgreSQL; email contains only a minimal administrative alert and never the intake answers.

---

## How It Works

### 1. **Generate & Send Intake Form Link**

Use the API to generate a unique link for any client:

```bash
curl -X POST http://localhost:5001/api/intake/generate-link \
  -H "Content-Type: application/json" \
  -d '{"userId": 123}'
```

**What happens:**
- A unique token is generated
- Durable email intent is queued for the client with a link to the intake form
- The link expires in 7 days
- Example link: `http://localhost:3000/intake/a1b2c3d4e5f6...`

---

### 2. **Client Completes the Form**

The client clicks the link and fills out a **3-page intake form** with:

#### **Page 1: Personal & Background** (8 questions)
- Marital status
- Children details
- Living situation
- Religious practice level
- Prayer frequency
- Quran engagement
- Community involvement

#### **Page 2: Mental Health & Concerns** (10 questions)
- Main concerns (detailed description)
- Concern duration & severity (1-10 scale)
- Therapy goals
- Mood symptoms (checklist)
- Anxiety symptoms (checklist)
- Sleep issues
- Suicidal thoughts screening

#### **Page 3: Health, Support & Background** (12 questions)
- Trauma history
- Relationship quality
- Relationship difficulties
- Social support system
- Physical health status
- Medical conditions
- Current medications
- Previous therapy experience
- Coping mechanisms
- Spiritual connection
- Additional information

---

### 3. **Admin Alert Is Queued**

When the client submits:
- Form data is stored in the database
- A minimal administrative alert is queued without answers, client identity, or a direct client-review link
- The token is marked as completed (can't be reused)
- Client sees a success page with "What happens next?" info

---

## API Endpoints

### Generate Link
```
POST /api/intake/generate-link
Body: { "userId": 123 }
Response: consult the current route contract; API success means durable intent, not confirmed delivery
```

### Verify Token
```
GET /api/intake/verify/:token
Response: { "client": { "id": 123, "email": "...", "full_name": "..." } }
```

### Submit Form
```
POST /api/intake/submit
Body: { "token": "...", ...formData }
Response: { "message": "Intake form submitted successfully" }
```

---

## Frontend Routes

- `/intake/:token` - Intake form page (3 steps)
- `/intake-success` - Success confirmation page

---

## Database Tables

### `intake_tokens`
Stores unique tokens for form links
- `user_id` - References users table
- `token` - Unique 64-character hex string
- `expires_at` - Expiration timestamp (7 days)
- `completed_at` - When form was submitted

### `intake_forms`
Stores all form responses
- `user_id` - References users table
- 30+ columns for all form fields
- JSONB arrays for multi-select questions
- `submitted_at` - Submission timestamp

---

## Email Notifications

### To Client: "Complete Your Intake Form"
- Personalized greeting
- Explanation of the form
- Big CTA button with unique link
- Expiration notice (7 days)

### To Admin: "Intake Form Completed"
- Minimal notice that an intake form was completed
- No intake answers, free-text notes, client identity, or nonexistent admin-client URL
- Authorized staff retrieve sensitive data through relationship-scoped application APIs

---

## Design Features

✨ **Same theme as questionnaire:**
- Brown-soft (#8B7355) primary color
- Ivory/sand background
- Gold accents
- Smooth animations
- Progress bar

✨ **User experience:**
- Step indicator (1 of 3, 2 of 3, etc.)
- Disabled "Next" until required fields filled
- Previous/Next navigation
- Validation on each step
- Success page with clear next steps

---

## Testing the System

### 1. Generate a link for a test user:
```bash
curl -X POST http://localhost:5001/api/intake/generate-link \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

### 2. Check the test client's inbox for the link

### 3. Click the link and complete the form

### 4. Verify the minimal administrative alert and the outbox/webhook delivery state

---

## How to Send to Real Clients

### Option 1: Integrate with a current authenticated workflow

Do not copy a detached email-helper snippet from this legacy guide. Token insertion and email intent must share the current route transaction, and the event key must use the one-way token digest rather than the bearer token or URL.

### Option 2: Admin panel button
Create an admin interface where you can:
- View all clients
- Click "Send Intake Form" button
- Calls `/api/intake/generate-link`

### Option 3: Manual API call
Use the curl command whenever you want to send a form to a specific user.

---

## Customization

### Add More Questions
Edit `IntakeFormPage.tsx`:
1. Add new state variable
2. Add input/selection in renderStep()
3. Include in formData object in handleSubmit()
4. Update backend route to handle new field
5. Add column to intake_forms table

### Change Branding
All colors are defined in Tailwind classes:
- `bg-brown-soft` - Primary buttons
- `bg-sand` - Page background
- `bg-ivory` - Card backgrounds
- `border-gold` - Selected state
- `text-brown-dark` - Dark text

### Modify Email Templates
Edit `emailService.js`:
- `sendIntakeFormLink()` - Link email to client
- `sendIntakeFormSubmission()` - Submission email to admin

---

## Important Notes

⚠️ **Security:**
- Tokens are single-use (marked completed after submission)
- Tokens expire after 7 days
- Each user can only have one active token

⚠️ **Privacy:**
- All data is confidential
- Stored securely in PostgreSQL
- Only shared with assigned therapist

⚠️ **Form Validation:**
- Required fields marked with *
- Step-by-step validation
- Can't proceed without completing required fields
- "Previous" button to go back and edit

---

## Troubleshooting

**Link not working?**
- Check token hasn't expired (7 days)
- Check token wasn't already used
- Verify user exists in database

**Email not sending?**
- Check `.env` has complete Resend configuration
- Verify the sender domain and webhook endpoint in Resend
- Check the outbox worker is enabled
- Inspect sanitized outbox state (`pending`, `failed`, `accepted`, `delivered`, or terminal state)
- Check backend logs without printing recipient addresses, tokens, bodies, or raw webhooks

**Form not submitting?**
- Check browser console for errors
- Verify backend is running on port 5001
- Check network tab for API call

---

## Next Steps

1. ✅ Database tables created
2. ✅ Backend routes implemented
3. ✅ Frontend pages created
4. ✅ Durable Resend email intent and signed webhook handling implemented
5. ✅ Routes added to App.tsx

**Ready for controlled development testing only.** Apply migrations through 018 and verify the outbox plus signed webhook lifecycle.
