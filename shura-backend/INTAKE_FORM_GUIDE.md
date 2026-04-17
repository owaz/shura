# Client Intake Form System - User Guide

## Overview
The intake form system allows you to send comprehensive questionnaires to clients via email. When clients complete the form, you receive all their responses automatically.

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
- An email is sent to the client with a link to the intake form
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

### 3. **Admin Receives Submission**

When the client submits:
- Form data is stored in the database
- Admin receives a comprehensive email with all responses
- The token is marked as completed (can't be reused)
- Client sees a success page with "What happens next?" info

---

## API Endpoints

### Generate Link
```
POST /api/intake/generate-link
Body: { "userId": 123 }
Response: { "message": "Intake form link sent successfully", "link": "..." }
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
- Client name and email
- All form responses organized by section
- Formatted HTML for easy reading
- Highlights critical info (e.g., suicidal thoughts)

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

### 2. Check your email (shuraa.life@gmail.com) for the link

### 3. Click the link and complete the form

### 4. Check email again for the submission notification

---

## How to Send to Real Clients

### Option 1: Automatically after signup
Add to your signup flow in `routes/auth.js`:

```javascript
// After successful signup
const { sendIntakeFormLink } = require('../utils/emailService');
const crypto = require('crypto');

const token = crypto.randomBytes(32).toString('hex');
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

await pool.query(
  'INSERT INTO intake_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
  [userId, token, expiresAt]
);

const intakeLink = `http://localhost:3000/intake/${token}`;
await sendIntakeFormLink(userEmail, userName, intakeLink);
```

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
- Check `.env` has correct Gmail credentials
- Verify App Password is correct
- Check backend logs for email errors

**Form not submitting?**
- Check browser console for errors
- Verify backend is running on port 5001
- Check network tab for API call

---

## Next Steps

1. ✅ Database tables created
2. ✅ Backend routes implemented
3. ✅ Frontend pages created
4. ✅ Email system configured
5. ✅ Routes added to App.tsx

**Ready to test!** Generate a link and try it out.
