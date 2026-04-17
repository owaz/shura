# / server.js

# const express = require('express');

# const cors = require('cors');

# const bcrypt = require('bcrypt');

# const jwt = require('jsonwebtoken');

# const { Pool } = require('pg');

# require('dotenv').config();

# 

# const app = express();

# const PORT = process.env.PORT || 5000;

# 

# // Database connection

# const pool = new Pool({

# &nbsp; user: process.env.DB\_USER,

# &nbsp; host: process.env.DB\_HOST,

# &nbsp; database: process.env.DB\_NAME,

# &nbsp; password: process.env.DB\_PASSWORD,

# &nbsp; port: process.env.DB\_PORT || 5432,

# });

# 

# // Test database connection
  pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Check your .env file settings!');
  } else {
    console.log('✅ Database connected successfully!');
    release();
  }
});

# // Middleware

# app.use(cors());

# app.use(express.json());

# 

# // JWT Secret

# const JWT\_SECRET = process.env.JWT\_SECRET || 'your-secret-key';

# 

# // Authentication Middleware

# const authenticateToken = (req, res, next) => {

# &nbsp; const authHeader = req.headers\['authorization'];

# &nbsp; const token = authHeader \&\& authHeader.split(' ')\[1];

# 

# &nbsp; if (!token) {

# &nbsp;   return res.status(401).json({ message: 'Access token required' });

# &nbsp; }

# 

# &nbsp; jwt.verify(token, JWT\_SECRET, (err, user) => {

# &nbsp;   if (err) return res.status(403).json({ message: 'Invalid token' });

# &nbsp;   req.user = user;

# &nbsp;   next();

# &nbsp; });

# };

# 

# // ==================== AUTH ROUTES ====================

# 

# // Client Signup

# app.post('/api/auth/signup', async (req, res) => {

# &nbsp; try {

# &nbsp;   const { email, password, fullName, phone } = req.body;

# 

# &nbsp;   // Check if user exists

# &nbsp;   const userExists = await pool.query(

# &nbsp;     'SELECT \* FROM users WHERE email = $1',

# &nbsp;     \[email]

# &nbsp;   );

# 

# &nbsp;   if (userExists.rows.length > 0) {

# &nbsp;     return res.status(400).json({ message: 'User already exists' });

# &nbsp;   }

# 

# &nbsp;   // Hash password

# &nbsp;   const hashedPassword = await bcrypt.hash(password, 10);

# 

# &nbsp;   // Insert user

# &nbsp;   const result = await pool.query(

# &nbsp;     'INSERT INTO users (email, password\_hash, full\_name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, full\_name',

# &nbsp;     \[email, hashedPassword, fullName, phone]

# &nbsp;   );

# 

# &nbsp;   const user = result.rows\[0];

# 

# &nbsp;   // Generate token

# &nbsp;   const token = jwt.sign({ id: user.id, email: user.email, type: 'client' }, JWT\_SECRET);

# 

# &nbsp;   res.status(201).json({

# &nbsp;     message: 'User created successfully',

# &nbsp;     token,

# &nbsp;     user: { id: user.id, email: user.email, fullName: user.full\_name }

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Signup error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Client Login

# app.post('/api/auth/login', async (req, res) => {

# &nbsp; try {

# &nbsp;   const { email, password } = req.body;

# 

# &nbsp;   // Find user

# &nbsp;   const result = await pool.query(

# &nbsp;     'SELECT \* FROM users WHERE email = $1',

# &nbsp;     \[email]

# &nbsp;   );

# 

# &nbsp;   if (result.rows.length === 0) {

# &nbsp;     return res.status(401).json({ message: 'Invalid credentials' });

# &nbsp;   }

# 

# &nbsp;   const user = result.rows\[0];

# 

# &nbsp;   // Verify password

# &nbsp;   const isValidPassword = await bcrypt.compare(password, user.password\_hash);

# 

# &nbsp;   if (!isValidPassword) {

# &nbsp;     return res.status(401).json({ message: 'Invalid credentials' });

# &nbsp;   }

# 

# &nbsp;   // Generate token

# &nbsp;   const token = jwt.sign({ id: user.id, email: user.email, type: 'client' }, JWT\_SECRET);

# 

# &nbsp;   res.json({

# &nbsp;     message: 'Login successful',

# &nbsp;     token,

# &nbsp;     user: { id: user.id, email: user.email, fullName: user.full\_name }

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Login error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // ==================== THERAPIST ROUTES ====================

# 

# // Therapist Application

# app.post('/api/therapists/apply', async (req, res) => {

# &nbsp; try {

# &nbsp;   const {

# &nbsp;     email,

# &nbsp;     password,

# &nbsp;     fullName,

# &nbsp;     specializations,

# &nbsp;     languages,

# &nbsp;     experienceYears,

# &nbsp;     bio,

# &nbsp;     education,

# &nbsp;     certifications,

# &nbsp;     hourlyRate

# &nbsp;   } = req.body;

# 

# &nbsp;   // Check if therapist exists

# &nbsp;   const therapistExists = await pool.query(

# &nbsp;     'SELECT \* FROM therapists WHERE email = $1',

# &nbsp;     \[email]

# &nbsp;   );

# 

# &nbsp;   if (therapistExists.rows.length > 0) {

# &nbsp;     return res.status(400).json({ message: 'Therapist already exists' });

# &nbsp;   }

# 

# &nbsp;   // Hash password

# &nbsp;   const hashedPassword = await bcrypt.hash(password, 10);

# 

# &nbsp;   // Insert therapist

# &nbsp;   const result = await pool.query(

# &nbsp;     `INSERT INTO therapists 

# &nbsp;      (email, password\_hash, full\_name, specializations, languages, 

# &nbsp;       experience\_years, bio, education, certifications, hourly\_rate) 

# &nbsp;      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 

# &nbsp;      RETURNING id, email, full\_name`,

# &nbsp;     \[email, hashedPassword, fullName, specializations, languages,

# &nbsp;      experienceYears, bio, education, certifications, hourlyRate]

# &nbsp;   );

# 

# &nbsp;   res.status(201).json({

# &nbsp;     message: 'Application submitted successfully. Awaiting verification.',

# &nbsp;     therapist: result.rows\[0]

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Application error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Therapist Login

# app.post('/api/therapists/login', async (req, res) => {

# &nbsp; try {

# &nbsp;   const { email, password } = req.body;

# 

# &nbsp;   const result = await pool.query(

# &nbsp;     'SELECT \* FROM therapists WHERE email = $1',

# &nbsp;     \[email]

# &nbsp;   );

# 

# &nbsp;   if (result.rows.length === 0) {

# &nbsp;     return res.status(401).json({ message: 'Invalid credentials' });

# &nbsp;   }

# 

# &nbsp;   const therapist = result.rows\[0];

# 

# &nbsp;   if (!therapist.is\_verified) {

# &nbsp;     return res.status(403).json({ message: 'Account not yet verified' });

# &nbsp;   }

# 

# &nbsp;   const isValidPassword = await bcrypt.compare(password, therapist.password\_hash);

# 

# &nbsp;   if (!isValidPassword) {

# &nbsp;     return res.status(401).json({ message: 'Invalid credentials' });

# &nbsp;   }

# 

# &nbsp;   const token = jwt.sign(

# &nbsp;     { id: therapist.id, email: therapist.email, type: 'therapist' },

# &nbsp;     JWT\_SECRET

# &nbsp;   );

# 

# &nbsp;   res.json({

# &nbsp;     message: 'Login successful',

# &nbsp;     token,

# &nbsp;     therapist: {

# &nbsp;       id: therapist.id,

# &nbsp;       email: therapist.email,

# &nbsp;       fullName: therapist.full\_name

# &nbsp;     }

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Login error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Get All Therapists (with filters)

# app.get('/api/therapists', async (req, res) => {

# &nbsp; try {

# &nbsp;   const { specialization, language, minRate, maxRate } = req.query;

# 

# &nbsp;   let query = 'SELECT \* FROM therapists WHERE is\_verified = true AND is\_active = true';

# &nbsp;   const params = \[];

# &nbsp;   let paramIndex = 1;

# 

# &nbsp;   if (specialization) {

# &nbsp;     query += ` AND $${paramIndex} = ANY(specializations)`;

# &nbsp;     params.push(specialization);

# &nbsp;     paramIndex++;

# &nbsp;   }

# 

# &nbsp;   if (language) {

# &nbsp;     query += ` AND $${paramIndex} = ANY(languages)`;

# &nbsp;     params.push(language);

# &nbsp;     paramIndex++;

# &nbsp;   }

# 

# &nbsp;   if (minRate) {

# &nbsp;     query += ` AND hourly\_rate >= $${paramIndex}`;

# &nbsp;     params.push(minRate);

# &nbsp;     paramIndex++;

# &nbsp;   }

# 

# &nbsp;   if (maxRate) {

# &nbsp;     query += ` AND hourly\_rate <= $${paramIndex}`;

# &nbsp;     params.push(maxRate);

# &nbsp;     paramIndex++;

# &nbsp;   }

# 

# &nbsp;   const result = await pool.query(query, params);

# 

# &nbsp;   res.json({ therapists: result.rows });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Error fetching therapists:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Get Therapist by ID

# app.get('/api/therapists/:id', async (req, res) => {

# &nbsp; try {

# &nbsp;   const { id } = req.params;

# 

# &nbsp;   const result = await pool.query(

# &nbsp;     'SELECT \* FROM therapists WHERE id = $1 AND is\_verified = true',

# &nbsp;     \[id]

# &nbsp;   );

# 

# &nbsp;   if (result.rows.length === 0) {

# &nbsp;     return res.status(404).json({ message: 'Therapist not found' });

# &nbsp;   }

# 

# &nbsp;   res.json({ therapist: result.rows\[0] });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Error fetching therapist:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // ==================== QUESTIONNAIRE ROUTES ====================

# 

# // Submit Questionnaire

# app.post('/api/questionnaire', authenticateToken, async (req, res) => {

# &nbsp; try {

# &nbsp;   const {

# &nbsp;     ageRange,

# &nbsp;     gender,

# &nbsp;     concerns,

# &nbsp;     therapyTypePreference,

# &nbsp;     languagePreference,

# &nbsp;     previousTherapy,

# &nbsp;     additionalNotes

# &nbsp;   } = req.body;

# 

# &nbsp;   const userId = req.user.id;

# 

# &nbsp;   // Check if profile exists

# &nbsp;   const existingProfile = await pool.query(

# &nbsp;     'SELECT \* FROM client\_profiles WHERE user\_id = $1',

# &nbsp;     \[userId]

# &nbsp;   );

# 

# &nbsp;   let result;

# 

# &nbsp;   if (existingProfile.rows.length > 0) {

# &nbsp;     // Update existing profile

# &nbsp;     result = await pool.query(

# &nbsp;       `UPDATE client\_profiles 

# &nbsp;        SET age\_range = $1, gender = $2, concerns = $3, 

# &nbsp;            therapy\_type\_preference = $4, language\_preference = $5, 

# &nbsp;            previous\_therapy = $6, additional\_notes = $7

# &nbsp;        WHERE user\_id = $8 

# &nbsp;        RETURNING \*`,

# &nbsp;       \[ageRange, gender, concerns, therapyTypePreference, languagePreference,

# &nbsp;        previousTherapy, additionalNotes, userId]

# &nbsp;     );

# &nbsp;   } else {

# &nbsp;     // Insert new profile

# &nbsp;     result = await pool.query(

# &nbsp;       `INSERT INTO client\_profiles 

# &nbsp;        (user\_id, age\_range, gender, concerns, therapy\_type\_preference, 

# &nbsp;         language\_preference, previous\_therapy, additional\_notes) 

# &nbsp;        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 

# &nbsp;        RETURNING \*`,

# &nbsp;       \[userId, ageRange, gender, concerns, therapyTypePreference,

# &nbsp;        languagePreference, previousTherapy, additionalNotes]

# &nbsp;     );

# &nbsp;   }

# 

# &nbsp;   res.json({

# &nbsp;     message: 'Questionnaire submitted successfully',

# &nbsp;     profile: result.rows\[0]

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Questionnaire error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Get Matched Therapists

# app.get('/api/matching/therapists', authenticateToken, async (req, res) => {

# &nbsp; try {

# &nbsp;   const userId = req.user.id;

# 

# &nbsp;   // Get client profile

# &nbsp;   const profileResult = await pool.query(

# &nbsp;     'SELECT \* FROM client\_profiles WHERE user\_id = $1',

# &nbsp;     \[userId]

# &nbsp;   );

# 

# &nbsp;   if (profileResult.rows.length === 0) {

# &nbsp;     return res.status(404).json({ message: 'Please complete the questionnaire first' });

# &nbsp;   }

# 

# &nbsp;   const profile = profileResult.rows\[0];

# 

# &nbsp;   // Match therapists based on language and concerns (basic matching)

# &nbsp;   const therapistsResult = await pool.query(

# &nbsp;     `SELECT \* FROM therapists 

# &nbsp;      WHERE is\_verified = true 

# &nbsp;      AND is\_active = true 

# &nbsp;      AND $1 = ANY(languages)

# &nbsp;      ORDER BY RANDOM()

# &nbsp;      LIMIT 5`,

# &nbsp;     \[profile.language\_preference]

# &nbsp;   );

# 

# &nbsp;   res.json({ therapists: therapistsResult.rows });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Matching error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // ==================== APPOINTMENT ROUTES ====================

# 

# // Book Appointment

# app.post('/api/appointments', authenticateToken, async (req, res) => {

# &nbsp; try {

# &nbsp;   const { therapistId, appointmentDate, durationMinutes } = req.body;

# &nbsp;   const clientId = req.user.id;

# 

# &nbsp;   // Check if slot is available (basic check)

# &nbsp;   const existingAppointment = await pool.query(

# &nbsp;     `SELECT \* FROM appointments 

# &nbsp;      WHERE therapist\_id = $1 

# &nbsp;      AND appointment\_date = $2 

# &nbsp;      AND status != 'cancelled'`,

# &nbsp;     \[therapistId, appointmentDate]

# &nbsp;   );

# 

# &nbsp;   if (existingAppointment.rows.length > 0) {

# &nbsp;     return res.status(400).json({ message: 'This time slot is not available' });

# &nbsp;   }

# 

# &nbsp;   const result = await pool.query(

# &nbsp;     `INSERT INTO appointments 

# &nbsp;      (client\_id, therapist\_id, appointment\_date, duration\_minutes, status) 

# &nbsp;      VALUES ($1, $2, $3, $4, 'scheduled') 

# &nbsp;      RETURNING \*`,

# &nbsp;     \[clientId, therapistId, appointmentDate, durationMinutes || 60]

# &nbsp;   );

# 

# &nbsp;   res.status(201).json({

# &nbsp;     message: 'Appointment booked successfully',

# &nbsp;     appointment: result.rows\[0]

# &nbsp;   });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Booking error:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Get User Appointments

# app.get('/api/appointments', authenticateToken, async (req, res) => {

# &nbsp; try {

# &nbsp;   const userId = req.user.id;

# &nbsp;   const userType = req.user.type;

# 

# &nbsp;   let query;

# &nbsp;   if (userType === 'client') {

# &nbsp;     query = `

# &nbsp;       SELECT a.\*, t.full\_name as therapist\_name, t.profile\_image\_url

# &nbsp;       FROM appointments a

# &nbsp;       JOIN therapists t ON a.therapist\_id = t.id

# &nbsp;       WHERE a.client\_id = $1

# &nbsp;       ORDER BY a.appointment\_date DESC

# &nbsp;     `;

# &nbsp;   } else {

# &nbsp;     query = `

# &nbsp;       SELECT a.\*, u.full\_name as client\_name

# &nbsp;       FROM appointments a

# &nbsp;       JOIN users u ON a.client\_id = u.id

# &nbsp;       WHERE a.therapist\_id = $1

# &nbsp;       ORDER BY a.appointment\_date DESC

# &nbsp;     `;

# &nbsp;   }

# 

# &nbsp;   const result = await pool.query(query, \[userId]);

# 

# &nbsp;   res.json({ appointments: result.rows });

# &nbsp; } catch (error) {

# &nbsp;   console.error('Error fetching appointments:', error);

# &nbsp;   res.status(500).json({ message: 'Server error' });

# &nbsp; }

# });

# 

# // Health check

# app.get('/api/health', (req, res) => {

# &nbsp; res.json({ status: 'OK', message: 'Shura API is running' });

# });

# 

# // Start server

# app.listen(PORT, () => {

# &nbsp; console.log(`Server running on port ${PORT}`);

# });

