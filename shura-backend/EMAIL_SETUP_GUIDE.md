# Email Notification Setup Guide

## Gmail Configuration for Nodemailer

To enable email notifications for therapist applications, you need to set up Gmail App Passwords.

### Step 1: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Under "How you sign in to Google", click on **2-Step Verification**
4. Follow the prompts to enable 2FA (if not already enabled)

### Step 2: Generate App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" as the app
3. Select "Other (Custom name)" as the device
4. Enter "Shura Backend" as the name
5. Click **Generate**
6. Copy the 16-character password (it will look like: `xxxx xxxx xxxx xxxx`)

### Step 3: Update Your .env File

Open `/shura-backend/.env` and update these values:

```env
# Email Configuration (Gmail)
EMAIL_USER=your-actual-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # The 16-character app password you just generated
ADMIN_EMAIL=your-actual-email@gmail.com  # Email where you want to receive notifications
```

**Important:**
- `EMAIL_USER`: The Gmail account that will send emails
- `EMAIL_PASSWORD`: The App Password (NOT your regular Gmail password)
- `ADMIN_EMAIL`: Where therapist application notifications will be sent (can be the same or different)

### Step 4: Restart Your Backend Server

After updating the .env file, restart your server:

```bash
cd /Users/asmafathima/Desktop/SHURA/shura-backend
# Kill any running server
pkill -f "node server.js"
# Start the server
node server.js
```

### Step 5: Test the Email Notification

1. Go to your website: http://localhost:3000
2. Navigate to the therapist signup page
3. Fill out the application form
4. Submit the application
5. Check your ADMIN_EMAIL inbox for the notification

---

## Email Features Implemented

### 1. **Therapist Application Notification (To Admin)**
- Sent immediately when a therapist submits an application
- Contains all application details in a formatted table
- Includes SQL commands to approve/reject the application
- Beautiful HTML email with Shura branding

### 2. **Therapist Approval Email (To Therapist)** *(Optional - not yet implemented)*
- Can be sent when you approve a therapist
- Welcomes them to the platform
- Provides login link and next steps

---

## Troubleshooting

### Issue: "Invalid login: 535-5.7.8 Username and Password not accepted"
**Solution:** You're using your regular Gmail password instead of an App Password. Follow Step 2 above.

### Issue: "self-signed certificate in certificate chain"
**Solution:** Add this to your .env:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```
(Not recommended for production)

### Issue: Emails not sending
**Solution:** 
1. Check your .env file has correct EMAIL_USER and EMAIL_PASSWORD
2. Make sure 2FA is enabled on your Gmail account
3. Check server logs for error messages
4. Try sending a test email from Node.js console

---

## Testing Email Service

You can test the email service directly from Node.js:

```javascript
// Test email sending
const { sendTherapistApplicationNotification } = require('./utils/emailService');

sendTherapistApplicationNotification({
  fullName: 'Test Therapist',
  email: 'test@example.com',
  phone: '1234567890',
  licenseNumber: 'TEST123',
  experience: 5,
  specialties: 'CBT, Mindfulness',
  sessionTypes: ['Video', 'Audio'],
  rate60min: 1500,
  availability: 'Weekdays 9AM-5PM'
}).then(result => {
  console.log('Test email result:', result);
});
```

---

## Security Notes

- **Never commit your .env file to Git** - it contains sensitive credentials
- App Passwords are safer than regular passwords
- If compromised, you can revoke the App Password without changing your Gmail password
- For production, consider using professional email services like SendGrid or AWS SES

---

## Current Email Flow

```
Therapist applies 
    ↓
Data saved to PostgreSQL database
    ↓
Email notification sent to ADMIN_EMAIL (non-blocking)
    ↓
You receive email with application details
    ↓
You review in database
    ↓
You approve/reject using SQL command
    ↓
(Optional) Send approval email to therapist
```
