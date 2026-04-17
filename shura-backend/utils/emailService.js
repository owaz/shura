const nodemailer = require('nodemailer');

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
    return nodemailer.createTransporter({
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
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.fullName}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Email:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.email}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Phone:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">License Number:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.licenseNumber || 'N/A'}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Experience:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.experience} years</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Specialties:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.specialties || 'N/A'}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Session Types:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.sessionTypes ? therapistData.sessionTypes.join(', ') : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Rate (60 min):</td>
                <td style="padding: 12px; border: 1px solid #ddd;">₹${therapistData.rate60min || 'N/A'}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Availability:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${therapistData.availability || 'N/A'}</td>
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
                3. To approve: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">UPDATE therapists SET status = 'approved' WHERE email = '${therapistData.email}';</code><br>
                4. To reject: <code style="background: #fff; padding: 2px 6px; border-radius: 3px;">UPDATE therapists SET status = 'rejected' WHERE email = '${therapistData.email}';</code>
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
            <p style="font-size: 16px; color: #333;">Dear ${therapistName},</p>
            
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
              <a href="http://localhost:3000/therapist-login" style="display: inline-block; background-color: #8B7355; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
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
                <td style="padding: 12px; border: 1px solid #ddd;">${clientData.fullName || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">Email:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${clientData.email}</td>
              </tr>
              <tr style="background-color: #f8f5f0;">
                <td style="padding: 12px; font-weight: bold; color: #8B7355; border: 1px solid #ddd;">User ID:</td>
                <td style="padding: 12px; border: 1px solid #ddd;">#${clientData.userId}</td>
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
                <span style="color: #555;">${clientData.concerns.join(', ')}</span>
              </div>
              
              <div style="margin-bottom: 15px;">
                <strong style="color: #8B7355;">Therapist Gender Preference:</strong><br>
                <span style="color: #555;">${clientData.genderPreference}</span>
              </div>
              
              <div>
                <strong style="color: #8B7355;">Additional Notes:</strong><br>
                <span style="color: #555; white-space: pre-wrap;">${clientData.additionalNotes}</span>
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
    console.log(`✅ Client signup notification sent to admin for: ${clientData.email}`);
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
            <p style="font-size: 16px; color: #333;">Dear ${clientName},</p>
            
            <p style="color: #555; line-height: 1.6;">
              Thank you for choosing Shura for your mental health journey. To help us provide you with the best possible care, 
              we ask that you complete a comprehensive intake form before your first session.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              This form helps your therapist understand your background, concerns, and goals. It takes approximately 10-15 minutes to complete.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${intakeLink}" 
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
      subject: `📋 Intake Form Completed - ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f8f5f0; border-radius: 10px;">
          <div style="background-color: #8B7355; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Intake Form Submission</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px;">Client Information</h2>
            <p><strong>Name:</strong> ${clientName}</p>
            <p><strong>Email:</strong> ${clientEmail}</p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Personal & Background</h2>
            <p><strong>Marital Status:</strong> ${formData.maritalStatus || 'Not provided'}</p>
            <p><strong>Children:</strong> ${formData.hasChildren === 'Yes' ? `Yes - ${formData.childrenDetails}` : formData.hasChildren || 'Not provided'}</p>
            <p><strong>Living Situation:</strong> ${formData.livingSituation || 'Not provided'}</p>
            <p><strong>Religious Practice:</strong> ${formData.religiousPractice || 'Not provided'}</p>
            <p><strong>Prayer Frequency:</strong> ${formData.prayerFrequency || 'Not provided'}</p>
            <p><strong>Quran Engagement:</strong> ${formData.quranEngagement || 'Not provided'}</p>
            <p><strong>Community Involvement:</strong> ${formData.communityInvolvement || 'Not provided'}</p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Mental Health Concerns</h2>
            <p><strong>Main Concerns:</strong><br/>${formData.mainConcerns?.replace(/\n/g, '<br/>') || 'Not provided'}</p>
            <p><strong>Duration:</strong> ${formData.concernDuration || 'Not provided'}</p>
            <p><strong>Severity:</strong> ${formData.concernSeverity || 'Not provided'}/10</p>
            <p><strong>Therapy Goals:</strong><br/>${formData.therapyGoals?.replace(/\n/g, '<br/>') || 'Not provided'}</p>
            
            <p><strong>Mood Symptoms:</strong> ${formData.moodSymptoms?.length > 0 ? formData.moodSymptoms.join(', ') : 'None selected'}</p>
            <p><strong>Anxiety Symptoms:</strong> ${formData.anxietySymptoms?.length > 0 ? formData.anxietySymptoms.join(', ') : 'None selected'}</p>
            <p><strong>Sleep Issues:</strong> ${formData.sleepIssues?.length > 0 ? formData.sleepIssues.join(', ') : 'None selected'}</p>
            
            <p style="background-color: ${formData.suicidalThoughts === 'Yes, currently' ? '#ffebee' : '#f5f5f5'}; padding: 10px; border-radius: 5px;">
              <strong>Suicidal Thoughts:</strong> ${formData.suicidalThoughts || 'Not provided'}
              ${formData.suicidalDetails ? `<br/><strong>Details:</strong> ${formData.suicidalDetails}` : ''}
            </p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Health & Support</h2>
            <p><strong>Trauma History:</strong> ${formData.traumaHistory?.length > 0 ? formData.traumaHistory.join(', ') : 'None selected'}</p>
            <p><strong>Relationship Quality:</strong> ${formData.relationshipQuality || 'Not provided'}</p>
            <p><strong>Relationship Difficulties:</strong> ${formData.relationshipDifficulties?.length > 0 ? formData.relationshipDifficulties.join(', ') : 'None selected'}</p>
            <p><strong>Social Support:</strong> ${formData.socialSupport || 'Not provided'}</p>
            
            <p><strong>Physical Health:</strong> ${formData.physicalHealth || 'Not provided'}</p>
            <p><strong>Medical Conditions:</strong> ${formData.medicalConditions || 'Not provided'}</p>
            <p><strong>Current Medications:</strong> ${formData.currentMedications || 'Not provided'}</p>
            
            <p><strong>Previous Therapy:</strong> ${formData.previousTherapy || 'Not provided'}
              ${formData.previousTherapyDetails ? `<br/>${formData.previousTherapyDetails}` : ''}
            </p>
            
            <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Spiritual & Coping</h2>
            <p><strong>Coping Mechanisms:</strong> ${formData.copingMechanisms?.length > 0 ? formData.copingMechanisms.join(', ') : 'None selected'}</p>
            <p><strong>Spiritual Connection:</strong> ${formData.spiritualConnection || 'Not provided'}</p>
            
            ${formData.additionalInfo ? `
              <h2 style="color: #8B7355; border-bottom: 2px solid #8B7355; padding-bottom: 10px; margin-top: 30px;">Additional Information</h2>
              <p>${formData.additionalInfo.replace(/\n/g, '<br/>')}</p>
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

module.exports = {
  sendTherapistApplicationNotification,
  sendTherapistApprovalEmail,
  sendClientSignupNotification,
  sendIntakeFormLink,
  sendIntakeFormSubmission,
};
