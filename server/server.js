const path = require('path');
const dotenv = require('dotenv');

// ----------------------------------------------------
// LOAD ENVIRONMENT VARIABLES (Local fallback)
// ----------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.join(__dirname, '.env');
  const envResult = dotenv.config({ path: envPath });
  console.log(`Checking local .env file at: ${envPath}`);
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
const axios = require('axios');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { ServerApiVersion } = require('mongodb');

// ----------------------------------------------------
// SENDGRID INITIALIZATION
// ----------------------------------------------------
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY.trim());
  console.log('⚡ SendGrid Email Service initialized!');
} else {
  console.warn('⚠️ SENDGRID_API_KEY is missing from environment variables');
}

// ----------------------------------------------------
// FIREBASE ADMIN INITIALIZATION
// ----------------------------------------------------
console.log("👉 STARTING FIREBASE SETUP...");

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

if (FIREBASE_PRIVATE_KEY) {
  FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

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
  console.error("❌ Error: MONGO_URI is not defined in environment variables.");
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
// SCHEMA & MODEL
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
// ROUTES
// ----------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).send('⚡ PUMA X HYROX API Service is Running.');
});

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

    let formattedContact = contact ? contact.toString().trim() : '';
    if (formattedContact && !formattedContact.startsWith('+')) {
      formattedContact = `+91${formattedContact.replace(/\D/g, '')}`;
    }

    const newReg = new Registration({
      name,
      contact: formattedContact,
      email,
      age,
      gender,
      sessionDetails: { date, timeSlot },
      referenceId,
      fcmToken: fcmToken || null,
    });

    await newReg.save();

    // Respond immediately to frontend
    res.status(201).json({
      message: 'Registered successfully',
      referenceId,
      data: newReg
    });

    // Background Async Tasks
    (async () => {
      console.log(`📨 Starting background notifications for ${referenceId}`);

      // SendGrid Email
      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        try {
          const emailData = {
            to: email,
            from: {
              email: process.env.SENDGRID_FROM_EMAIL,
              name: 'PUMA X HYROX'
            },
            subject: '⚡ Your PUMA X HYROX Registration Pass',
            html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="UTF-8"></head>
              <body style="margin: 0; padding: 0; background-color: #f2f6f3; font-family: 'Helvetica Neue', Arial, sans-serif;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f2f6f3; padding: 30px 10px;">
                  <tr>
                    <td align="center">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #d2ded6; overflow: hidden;">
                        <tr>
                          <td style="height: 6px; background: linear-gradient(135deg, #65D2CA 0%, #AAC85C 100%);"></td>
                        </tr>
                        <tr>
                          <td style="padding: 28px;">
                            <h2 style="color: #0f5c53; font-style: italic; margin-top: 0; font-size: 28px;">PUMA X HYROX</h2>
                            <p style="font-size: 15px; color: #08120e;">Hi <strong>${name}</strong>,</p>
                            <p style="font-size: 15px; color: #495e54;">Your registration is confirmed! Below are your station details:</p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e8f0eb; border: 2px dashed #0f5c53; border-radius: 10px; padding: 16px; margin: 20px 0;">
                              <tr><td style="padding: 6px 0; font-family: monospace;"><strong>REFERENCE:</strong> ${referenceId}</td></tr>
                              <tr><td style="padding: 6px 0; font-family: monospace;"><strong>DATE:</strong> ${date}</td></tr>
                              <tr><td style="padding: 6px 0; font-family: monospace;"><strong>SLOT TIME:</strong> ${timeSlot}</td></tr>
                            </table>
                            <p style="font-size: 13px; color: #495e54;">Please report to the venue 15 minutes prior to your time slot.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `
          };
          await sgMail.send(emailData);
          console.log(`✅ SendGrid Email sent to ${email}`);
        } catch (err) {
          console.error('❌ SendGrid Error:', err.message);
        }
      }

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
          console.log('✅ FCM Push sent');
        } catch (err) {
          console.error('❌ FCM Error:', err.message);
        }
      }

      // MailBluster Integration
      const mailblusterKey = process.env.MAILBLUSTER_API_KEY ? process.env.MAILBLUSTER_API_KEY.trim() : '';
      if (mailblusterKey) {
        try {
          await axios.post(
            'https://api.mailbluster.com/api/leads',
            {
              email,
              subscribed: true,
              firstName: name,
              meta: { phone: formattedContact, age, gender, referenceId, sessionDate: date, timeSlot },
              tags: ['PUMA HYROX 2026']
            },
            { headers: { 'Authorization': mailblusterKey, 'Content-Type': 'application/json' } }
          );
          console.log('✅ MailBluster Lead created');
        } catch (err) {
          console.error('❌ MailBluster Error:', err.response?.data || err.message);
        }
      }

      // Twilio SMS
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            body: `Hi ${name}, your PUMA X HYROX booking is confirmed! Ref: ${referenceId} | Date: ${date} | Time: ${timeSlot}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedContact
          });
          console.log('✅ Twilio SMS sent to:', formattedContact);
        } catch (err) {
          console.error('❌ Twilio SMS Error:', err.message);
        }
      }

      console.log(`✅ Background notifications completed for ${referenceId}`);
    })().catch(bgErr => console.error('❌ Background Job Error:', bgErr));

  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: err.message });
  }
});

function generateSlots() {
  const times = [];
  let current = 10 * 60;
  const end = 21 * 60;

  while (current + 15 <= end) {
    if (current >= 13 * 60 && current + 15 <= 14 * 60) {
      current = 14 * 60;
      continue;
    }

    const format = (min) => {
      let h = Math.floor(min / 60);
      const m = min % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    times.push(`${format(current)} - ${format(current + 15)}`);
    current += 20;
  }

  return times;
}

app.get('/api/slots', (req, res) => {
  res.json({
    dates: ['24 JUL', '25 JUL', '26 JUL'],
    slots: generateSlots()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));