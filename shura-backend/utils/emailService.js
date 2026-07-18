const nodemailer = require('nodemailer');

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const textOrFallback = (value, fallback = 'N/A') => {
  if (value === undefined || value === null || value === '') return fallback;
  return escapeHtml(value);
};

const listOrFallback = (value, fallback = 'None selected') => {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((item) => escapeHtml(item)).join(', ');
};

const multilineOrFallback = (value, fallback = 'Not provided') => {
  if (value === undefined || value === null || value === '') return fallback;
  return escapeHtml(value).replace(/\n/g, '<br/>');
};

const frontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3006').replace(/\/$/, '');
const frontendUrl = (path = '/') => `${frontendBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

// Create reusable transporter
const createTransporter = () => {
  // Check if we're using App Password or regular Gmail
  if (process.env.EMAIL_PASSWORD && process.env.EMAIL_PASSWORD.length === 16 && !process.env.EMAIL_PASSWORD.includes(' ')) {
    // Using App Password (no spaces, 16 chars)
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Using regular password - requires less secure app access or OAuth2
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
};

// Send new therapist application notification to admin
const sendTherapistApplicationNotification = async (therapistData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: '🩺 New Therapist Application - Shura Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Shura - New Therapist Application</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">You have received a new therapist application:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Full Name:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.fullName)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Email:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.email)}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Phone:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.phone)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">License Number:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.licenseNumber)}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Experience:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.experience)} years</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Specialties:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.specialties)}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Session Types:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${Array.isArray(therapistData.sessionTypes) && therapistData.sessionTypes.length > 0 ? listOrFallback(therapistData.sessionTypes, 'N/A') : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Rate (60 min):</td>
                <td style="padding: 12px; border: 1px solid #ddd;">₹${textOrFallback(therapistData.rate60min)}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Availability:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(therapistData.availability)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Applied On:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              </tr>
            </table>
            
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f5f0; border-radius: 8px; border-left: 4px solid #8B7355;">
              <h3 style="color: #8B7355; margin-top: 0;">Next Steps:</h3>
              <p style="color: #555; line-height: 1.6;">
                1. Log in to your PostgreSQL database<br>
                2. Review the application details<br>
                3. To approve: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">UPDATE therapists SET status = 'approved' WHERE email = '${textOrFallback(therapistData.email)}';</code><br>
                4. To reject: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">UPDATE therapists SET status = 'rejected' WHERE email = '${textOrFallback(therapistData.email)}';</code>
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #8B7355; font-size: 12px;">
            <p>This is an automated notification from Shura Platform</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Application notification sent to admin for: ${therapistData.email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending therapist application email:', error);
    return { success: false, error: error.message };
  }
};

// Send approval email to therapist
const sendTherapistApprovalEmail = async (therapistEmail, therapistName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: therapistEmail,
      subject: '🎉 Your Therapist Application has been Approved - Shura',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Welcome to Shura! 🎉</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">Dear ${textOrFallback(therapistName)},</p>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Congratulations! Your application to join Shura's therapist network has been <strong style="color: #8B7355;">approved</strong>. 
              We are excited to have you as part of our faith-centered mental health community.
            </p>
            
            <div style="margin: 30px 0; padding: 20px; background-color: #f8f5f0; border-radius: 8px; border-left: 4px solid #8B7355;">
              <h3 style="color: #8B7355; margin-top: 0;">Next Steps:</h3>
              <ol style="color: #555; line-height: 1.8;">
                <li>Log in to your therapist portal</li>
                <li>Complete your profile with additional details</li>
                <li>Set your availability schedule</li>
                <li>Start connecting with clients seeking guidance</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl('/therapist-login')}" style="display: inline-block; background-color: #8B7355; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Login to Your Portal
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              If you have any questions or need assistance, please don't hesitate to reach out to our support team.
            </p>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Warm regards,<br>
              <strong style="color: #8B7355;">The Shura Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #8B7355; font-size: 12px;">
            <p>This is an automated message from Shura Platform</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to: ${therapistEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    return { success: false, error: error.message };
  }
};

// Send client signup notification to admin
const sendClientSignupNotification = async (clientData) => {
  try {
    const transporter = createTransporter();
    
    const hasQuestionnaire = clientData.concerns && clientData.concerns.length > 0;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: '👤 New Client Signup - Shura Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Shura - New Client Signup</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">A new client has signed up on the platform:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Full Name:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(clientData.fullName, 'Not provided')}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Email:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${textOrFallback(clientData.email)}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">User ID:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">#${textOrFallback(clientData.userId)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Signed Up On:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              </tr>
            </table>
            
            ${hasQuestionnaire ? `
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f5f0; border-radius: 8px; border-left: 4px solid #8B7355;">
              <h3 style="color: #8B7355; margin-top: 0;">📋 Questionnaire Responses:</h3>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #8B7355;">Primary Concerns:</strong><br>
                <span style="color: #555;">${listOrFallback(clientData.concerns)}</span>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #8B7355;">Therapist Gender Preference:</strong><br>
                <span style="color: #555;">${textOrFallback(clientData.genderPreference, 'Not provided')}</span>
              </div>
              
              <div>
                <strong style="color: #8B7355;">Additional Notes:</strong><br>
                <span style="color: #555; white-space: pre-wrap;">${textOrFallback(clientData.additionalNotes, 'Not provided')}</span>
              </div>
            </div>
            ` : `
            <div style="margin-top: 30px; padding: 20px; background-color: #fff8e1; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="color: #666; margin: 0;">⚠️ Questionnaire not yet completed by client</p>
            </div>
            `}
            
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f5f0; border-radius: 8px; border-left: 4px solid #8B7355;">
              <h3 style="color: #8B7355; margin-top: 0;">Client Activity:</h3>
              <p style="color: #555; line-height: 1.6;">
                The client can now:<br>
                • Browse therapists<br>
                • Book appointments<br>
                • Access mental health resources<br>
                • Connect with faith-centered support
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #8B7355; font-size: 12px;">
            <p>This is an automated notification from Shura Platform</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Client signup notification sent to admin for: ${textOrFallback(clientData.email)}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending client signup email:', error);
    return { success: false, error: error.message };
  }
};

// Send intake form link to client
const sendIntakeFormLink = async (clientEmail, clientName, intakeLink) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: '📋 Complete Your Intake Form - Shura',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Shura - Intake Form</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">Dear ${textOrFallback(clientName)},</p>
            
            <p style="color: #555; line-height: 1.6;">
              Thank you for choosing Shura for your mental health journey. To help us provide you with the best possible care, 
              we ask that you complete a comprehensive intake form before your first session.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              This form helps your therapist understand your background, concerns, and goals. It takes approximately 10-15 minutes to complete.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${escapeHtml(intakeLink)}" 
                 style="background-color: #8B7355; color: #ffffff; padding: 15px 40px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                Complete Intake Form
              </a>
            </div>
            
            <p style="color: #888; font-size: 14px; line-height: 1.6;">
              <strong>Note:</strong> This link will expire in 7 days. Your information is confidential and will only be shared with your assigned therapist.
            </p>
            
            <p style="color: #555; margin-top: 20px;">
              If you have any questions, please don't hesitate to reach out.
            </p>
            
            <p style="color: #555;">
              Warm regards,<br/>
              <strong>The Shura Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #8B7355; font-size: 12px;">
            <p>This is an automated email from Shura Platform</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Intake form link sent to: ${clientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending intake form link:', error);
    return { success: false, error: error.message };
  }
};

// Send intake form submission notification to admin
const sendIntakeFormSubmission = async (clientEmail, clientName, formData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `📋 Intake Form Completed - ${String(clientName || 'Client')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Intake Form Submission</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px;">Client Information</h2>
            <p><strong>Name:</strong> ${textOrFallback(clientName)}</p>
            <p><strong>Email:</strong> ${textOrFallback(clientEmail)}</p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Personal & Background</h2>
            <p><strong>Marital Status:</strong> ${textOrFallback(formData.maritalStatus, 'Not provided')}</p>
            <p><strong>Children:</strong> ${formData.hasChildren === 'Yes' ? `Yes - ${textOrFallback(formData.childrenDetails, 'Not provided')}` : textOrFallback(formData.hasChildren, 'Not provided')}</p>
            <p><strong>Living Situation:</strong> ${textOrFallback(formData.livingSituation, 'Not provided')}</p>
            <p><strong>Religious Practice:</strong> ${textOrFallback(formData.religiousPractice, 'Not provided')}</p>
            <p><strong>Prayer Frequency:</strong> ${textOrFallback(formData.prayerFrequency, 'Not provided')}</p>
            <p><strong>Quran Engagement:</strong> ${textOrFallback(formData.quranEngagement, 'Not provided')}</p>
            <p><strong>Community Involvement:</strong> ${textOrFallback(formData.communityInvolvement, 'Not provided')}</p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Mental Health Concerns</h2>
            <p><strong>Main Concerns:</strong><br/>${multilineOrFallback(formData.mainConcerns)}</p>
            <p><strong>Duration:</strong> ${textOrFallback(formData.concernDuration, 'Not provided')}</p>
            <p><strong>Severity:</strong> ${textOrFallback(formData.concernSeverity, 'Not provided')}/10</p>
            <p><strong>Therapy Goals:</strong><br/>${multilineOrFallback(formData.therapyGoals)}</p>
            
            <p><strong>Mood Symptoms:</strong> ${listOrFallback(formData.moodSymptoms)}</p>
            <p><strong>Anxiety Symptoms:</strong> ${listOrFallback(formData.anxietySymptoms)}</p>
            <p><strong>Sleep Issues:</strong> ${listOrFallback(formData.sleepIssues)}</p>
            
            <p style="background-color: ${formData.suicidalThoughts === 'Yes, currently' ? '#ffebee' : '#f5f5f5'}; padding: 10px; border-radius: 5px;">
              <strong>Suicidal Thoughts:</strong> ${textOrFallback(formData.suicidalThoughts, 'Not provided')}
              ${formData.suicidalDetails ? `<br/><strong>Details:</strong> ${textOrFallback(formData.suicidalDetails)}` : ''}
            </p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Health & Support</h2>
            <p><strong>Trauma History:</strong> ${listOrFallback(formData.traumaHistory)}</p>
            <p><strong>Relationship Quality:</strong> ${textOrFallback(formData.relationshipQuality, 'Not provided')}</p>
            <p><strong>Relationship Difficulties:</strong> ${listOrFallback(formData.relationshipDifficulties)}</p>
            <p><strong>Social Support:</strong> ${textOrFallback(formData.socialSupport, 'Not provided')}</p>
            
            <p><strong>Physical Health:</strong> ${textOrFallback(formData.physicalHealth, 'Not provided')}</p>
            <p><strong>Medical Conditions:</strong> ${textOrFallback(formData.medicalConditions, 'Not provided')}</p>
            <p><strong>Current Medications:</strong> ${textOrFallback(formData.currentMedications, 'Not provided')}</p>
            
            <p><strong>Previous Therapy:</strong> ${textOrFallback(formData.previousTherapy, 'Not provided')}
              ${formData.previousTherapyDetails ? `<br/>${textOrFallback(formData.previousTherapyDetails)}` : ''}
            </p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Spiritual & Coping</h2>
            <p><strong>Coping Mechanisms:</strong> ${listOrFallback(formData.copingMechanisms)}</p>
            <p><strong>Spiritual Connection:</strong> ${textOrFallback(formData.spiritualConnection, 'Not provided')}</p>
            
            ${formData.additionalInfo ? `
              <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Additional Information</h2>
              <p>${multilineOrFallback(formData.additionalInfo)}</p>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #8B7355; font-size: 12px;">
            <p>This is an automated notification from Shura Platform</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Intake form submission notification sent for: ${clientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending intake form submission email:', error);
    return { success: false, error: error.message };
  }
};

const formatBookingDate = (value) => {
  if (!value) return 'your selected date';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? escapeHtml(value)
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const sendBookingConfirmation = async (bookingData) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: bookingData.clientEmail,
      subject: 'Your Shura session is booked',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Your Session Is Confirmed</h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">Dear ${textOrFallback(bookingData.clientName)},</p>
            <p style="color: #555; line-height: 1.6;">Your session with ${textOrFallback(bookingData.therapistName)} has been booked successfully.</p>
            <div style="margin: 24px 0; padding: 16px; background-color: #f8f5f0; border-radius: 8px;">
              <p style="margin: 6px 0; color: #555;"><strong>Session:</strong> ${textOrFallback(bookingData.sessionType)}</p>
              <p style="margin: 6px 0; color: #555;"><strong>Date:</strong> ${formatBookingDate(bookingData.date)}</p>
              <p style="margin: 6px 0; color: #555;"><strong>Time:</strong> ${textOrFallback(String(bookingData.time || '').slice(0, 5))}</p>
            </div>
            <p style="color: #555; line-height: 1.6;">We look forward to supporting you on your healing journey.</p>
            <p style="color: #555;">Warm regards,<br/><strong>The Shura Team</strong></p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Booking confirmation sent to: ${bookingData.clientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
    return { success: false, error: error.message };
  }
};

const sendBookingNotificationToTherapist = async (bookingData) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: bookingData.therapistEmail,
      subject: 'New Shura session booking',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">New Session Booking</h1>
          </div>
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">Dear ${textOrFallback(bookingData.therapistName)},</p>
            <p style="color: #555; line-height: 1.6;">${textOrFallback(bookingData.clientName)} has booked a session with you.</p>
            <div style="margin: 24px 0; padding: 16px; background-color: #f8f5f0; border-radius: 8px;">
              <p style="margin: 6px 0; color: #555;"><strong>Client:</strong> ${textOrFallback(bookingData.clientName)} (${textOrFallback(bookingData.clientEmail)})</p>
              <p style="margin: 6px 0; color: #555;"><strong>Session:</strong> ${textOrFallback(bookingData.sessionType)}</p>
              <p style="margin: 6px 0; color: #555;"><strong>Date:</strong> ${formatBookingDate(bookingData.date)}</p>
              <p style="margin: 6px 0; color: #555;"><strong>Time:</strong> ${textOrFallback(String(bookingData.time || '').slice(0, 5))}</p>
            </div>
            <p style="color: #555;">Please review your calendar for the updated appointment.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Booking notification sent to therapist: ${bookingData.therapistEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending therapist booking notification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendTherapistApplicationNotification,
  sendTherapistApprovalEmail,
  sendClientSignupNotification,
  sendIntakeFormLink,
  sendIntakeFormSubmission,
  sendBookingConfirmation,
  sendBookingNotificationToTherapist,
};
