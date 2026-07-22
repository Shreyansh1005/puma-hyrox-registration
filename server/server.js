const path = require('path');
const dotenv = require('dotenv');

// ----------------------------------------------------
// LOAD ENVIRONMENT VARIABLES
// ----------------------------------------------------
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath });

console.log(`🔍 Checking .env file at: ${envPath}`);
if (envResult.error) {
  console.error("❌ Failed to load .env file:", envResult.error.message);
} else {
  console.log("✅ .env file loaded successfully!");
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
// FIREBASE ADMIN INITIALIZATION (modular API — firebase-admin v14+)
// ----------------------------------------------------
console.log("👉 STARTING FIREBASE SETUP...");

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

console.log("Checking Firebase Env Keys:");
console.log(" - FIREBASE_PROJECT_ID:", FIREBASE_PROJECT_ID ? "LOADED" : "MISSING");
console.log(" - FIREBASE_CLIENT_EMAIL:", FIREBASE_CLIENT_EMAIL ? "LOADED" : "MISSING");
console.log(" - FIREBASE_PRIVATE_KEY:", FIREBASE_PRIVATE_KEY ? "LOADED" : "MISSING");

let firebaseInitialized = false;

console.log("Firebase apps registered BEFORE init attempt:", getApps().length);

if (getApps().length === 0) {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    try {
      initializeApp({
        credential: cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      firebaseInitialized = true;
      console.log('⚡ Firebase Admin SDK initialized successfully!');
    } catch (fbErr) {
      console.error('❌ Firebase Admin SDK initialization error:', fbErr);
    }
  } else {
    console.warn('⚠️ Firebase initialization skipped due to missing keys.');
  }
} else {
  firebaseInitialized = true;
  console.warn('⚠️ Firebase Admin already had', getApps().length, 'app(s) registered before init ran.');
}

// ----------------------------------------------------
// EXPRESS APP SETUP
// ----------------------------------------------------
const app = express();
// To allow all origins (fine for testing/development):
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(bodyParser.json());

// ----------------------------------------------------
// MONGOOSE DB CONNECTION
// ----------------------------------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ Error: MONGO_URI is not defined in your .env file.");
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
app.post('/api/register', async (req, res) => {
  try {
    const { name, contact, email, age, gender, date, timeSlot, fcmToken } = req.body;
    const referenceId = 'PUMA-HYROX-' + Date.now().toString().slice(-6);

    const newReg = new Registration({
      name,
      contact,
      email,
      age,
      gender,
      sessionDetails: {
        date,
        timeSlot,
      },
      referenceId,
      fcmToken: fcmToken || null,
    });

    await newReg.save();

    // ----------------------------------------------------
    // 1. PUSH NOTIFICATION (Firebase Cloud Messaging)
    // ----------------------------------------------------
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
        console.log('✅ FCM Push notification sent successfully to token!');
      } catch (fcmErr) {
        console.error('❌ Failed to send FCM push notification:', fcmErr.message);
      }
    } else {
      console.warn('⚠️ FCM Push Notification skipped (fcmToken missing or Firebase Admin not initialized).');
    }

    // ----------------------------------------------------
    // 2. EMAIL NOTIFICATION (Nodemailer)
    // ----------------------------------------------------
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        }
      });

      const mailOptions = {
        from: `"PUMA X HYROX" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '⚡ PUMA X HYROX Registration Confirmed',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f2f6f3; color: #08120e;">
            <h2 style="color: #0f5c53;">PUMA X HYROX — Registration Confirmed!</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>You are officially locked in for the race. Here are your telemetry details:</p>
            <table style="width: 100%; max-width: 500px; border-collapse: collapse; margin-top: 15px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Reference ID:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${referenceId}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${date}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Slot:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${timeSlot}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Contact:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${contact}</td></tr>
            </table>
            <br/>
            <p>See you at the starting line!</p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Confirmation email sent successfully to ${email}`);
      } catch (mailErr) {
        console.error('❌ Failed to send email:', mailErr.message);
      }
    } else {
      console.warn('⚠️ Email credentials missing in .env file. Email notification skipped.');
    }

    // ----------------------------------------------------
    // 3. SMS NOTIFICATION (Twilio)
    // ----------------------------------------------------
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Format recipient contact number (+91 for India)
      const formattedContact = contact.startsWith('+')
        ? contact
        : `+91${contact.replace(/[^0-9]/g, '').slice(-10)}`;

      try {
        const message = await client.messages.create({
          body: `Hi ${name}, your PUMA X HYROX registration is confirmed! Ref ID: ${referenceId}, Date: ${date}, Slot: ${timeSlot}.`,
          from: process.env.TWILIO_PHONE_NUMBER, // MUST be your Twilio trial/purchased number
          to: formattedContact                  // Recipient mobile number
        });
        console.log(`✅ SMS sent successfully to ${formattedContact}! SID: ${message.sid}`);
      } catch (smsErr) {
        console.error('❌ Failed to send SMS via Twilio:', smsErr.message);
      }
    } else {
      console.warn('⚠️ Twilio credentials missing in .env file. SMS notification skipped.');
    }

    res.status(201).json({
      message: 'Registered successfully',
      referenceId
    });
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