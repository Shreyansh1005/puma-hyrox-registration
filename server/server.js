const path = require('path');
const dotenv = require('dotenv');

// ----------------------------------------------------
// LOAD ENVIRONMENT VARIABLES (Local fallback)
// ----------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '.env');
  const envResult = dotenv.config({ path: envPath });
  console.log(`🔍 Checking local .env file at: ${envPath}`);
  if (envResult.error) {
    console.warn("⚠️ Local .env file not found or failed to load. Falling back to environment variables.");
  } else {
    console.log("✅ .env file loaded successfully!");
  }
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { ServerApiVersion } = require('mongodb');

// ----------------------------------------------------
// FIREBASE ADMIN INITIALIZATION (Modular API)
// ----------------------------------------------------
console.log("👉 STARTING FIREBASE SETUP...");

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

if (FIREBASE_PRIVATE_KEY) {
  // Ensure escaped newline characters are replaced properly
  FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

console.log("Checking Firebase Env Keys:");
console.log(" - FIREBASE_PROJECT_ID:", FIREBASE_PROJECT_ID ? "LOADED" : "MISSING");
console.log(" - FIREBASE_CLIENT_EMAIL:", FIREBASE_CLIENT_EMAIL ? "LOADED" : "MISSING");
console.log(" - FIREBASE_PRIVATE_KEY:", FIREBASE_PRIVATE_KEY ? "LOADED" : "MISSING");

let firebaseInitialized = false;

if (getApps().length === 0) {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY,
        }),
      });
      firebaseInitialized = true;
      console.log('⚡ Firebase Admin SDK initialized successfully!');
    } catch (fbErr) {
      console.error('❌ Firebase Admin SDK initialization error:', fbErr.message);
    }
  } else {
    console.warn('⚠️ Firebase initialization skipped due to missing keys.');
  }
} else {
  firebaseInitialized = true;
  console.warn('⚠️ Firebase Admin already registered before init ran.');
}

// ----------------------------------------------------
// EXPRESS APP SETUP
// ----------------------------------------------------
const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(bodyParser.json());

// ----------------------------------------------------
// MONGOOSE DB CONNECTION
// ----------------------------------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ Error: MONGO_URI is not defined in your environment variables.");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})
  .then(() => console.log('🍃 MongoDB Atlas connected successfully!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ----------------------------------------------------
// REGISTRATION SCHEMA & MODEL
// ----------------------------------------------------
const registrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    sessionDetails: {
      date: { type: String, required: true },
      timeSlot: { type: String, required: true },
    },
    referenceId: { type: String, required: true, unique: true },
    fcmToken: { type: String, default: null },
    status: { type: String, default: 'confirmed', enum: ['confirmed', 'cancelled'] },
  },
  { timestamps: true }
);

const Registration = mongoose.model('Registration', registrationSchema);

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check Endpoint (For Render Deployment)
app.get('/', (req, res) => {
  res.status(200).send('⚡ PUMA X HYROX API Service is Running.');
});
// GET Registration Details by Reference ID
app.get('/api/registration/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const registration = await Registration.findOne({ referenceId });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.status(200).json(registration);
  } catch (err) {
    console.error('❌ Error fetching registration:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, contact, email, age, gender, date, timeSlot, fcmToken } = req.body;
    const referenceId = 'PUMA-HYROX-' + Date.now().toString().slice(-6);

    // 1. Save to MongoDB first
    const newReg = new Registration({
      name,
      contact,
      email,
      age,
      gender,
      sessionDetails: { date, timeSlot },
      referenceId,
      fcmToken: fcmToken || null,
    });

    await newReg.save();

    // 2. RESPOND IMMEDIATELY TO FRONTEND (Instant transition to Stage 5!)
    res.status(201).json({
      message: 'Registered successfully',
      referenceId,
      data: newReg
    });

    // 3. SEND NOTIFICATIONS ASYNCHRONOUSLY IN BACKGROUND
    (async () => {
      // FCM Push
      if (fcmToken && firebaseInitialized) {
        try {
          await getMessaging().send({
            token: fcmToken,
            notification: {
              title: '⚡ PUMA X HYROX Registration Confirmed!',
              body: `Hi ${name}, your spot is locked in! Ref: ${referenceId}`,
            },
            data: { referenceId, date, timeSlot }
          });
          console.log('✅ FCM Push sent in background');
        } catch (err) {
          console.error('❌ FCM Error:', err.message);
        }
      }

      // Email
      // Email with SendGrid
if (process.env.SENDGRID_API_KEY) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: email,
      from: 'dubeyshreyansh2003@gmail.com',   // must be verified in SendGrid
      subject: '⚡ PUMA X HYROX Registration Confirmed',
      html: `<p>Hi ${name}, your booking Ref: <strong>${referenceId}</strong> is confirmed!</p>`
    });
    console.log('✅ SendGrid Email sent');
  } catch (err) {
    console.error('❌ SendGrid Error:', err.response?.body || err.message);
  }
}
// SMS with Twilio
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Hi ${name}, your PUMA X HYROX booking is confirmed! Ref: ${referenceId} | Date: ${date} | Time: ${timeSlot}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: contact  // assuming contact is in international format e.g. +91...
    });
    console.log('✅ Twilio SMS sent in background');
  } catch (err) {
    console.error('❌ Twilio SMS Error:', err.message);
  }
}
    })();

  } catch (err) {
    console.error('❌ Registration Endpoint Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/slots', (req, res) => {
  res.json({
    dates: ['2026-08-15', '2026-08-16'],
    slots: ['09:00 AM', '10:00 AM', '11:00 AM']
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));