const path = require('path');
const dotenv = require('dotenv');

// ----------------------------------------------------
// LOAD ENVIRONMENT VARIABLES
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
// CAPACITY CONFIGURATION
// ----------------------------------------------------
const CAPACITY_LIMITS = {
  participant: 12, // Set to 12 for production
  spectator: 5    // Set to 5 for production
};

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
let firebaseInitialized = false;
if (getApps().length === 0) {
  const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
  let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;

  if (FIREBASE_PRIVATE_KEY) {
    FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

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
const registrationSchema = new mongoose.Schema({
  name: String,
  contact: String,
  email: String,
  age: Number,
  gender: String,
  registrationType: { 
    type: String, 
    required: true, 
    enum: ['participant', 'spectator'], 
    default: 'participant' 
  },
  sessionDetails: {
    date: String,
    timeSlot: String,
    referenceId: String   // ← Simple String, no unique here
  },
  referenceId: { 
    type: String, 
    unique: true, 
    required: true 
  },
  status: { type: String, default: 'confirmed' },
  fcmToken: String
}, { timestamps: true });

const Registration = mongoose.model('Registration', registrationSchema);

// ----------------------------------------------------
// SLOT GENERATOR HELPER
// ----------------------------------------------------
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

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).send('⚡ PUMA X HYROX API Service is Running.');
});

// Fetch active slots with MongoDB booking counts
app.get('/api/slots', async (req, res) => {
  try {
    const counts = await Registration.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: {
            date: "$sessionDetails.date",
            timeSlot: "$sessionDetails.timeSlot",
            // If registrationType is missing in DB, fallback to 'participant'
            type: { $ifNull: [ "$registrationType", "participant" ] } 
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const bookedMap = {};
    counts.forEach(item => {
      const type = (item._id.type || 'participant').toString().toLowerCase().trim();
      const date = (item._id.date || '').toString().trim();
      const slot = (item._id.timeSlot || '').toString().trim();

      const key = `${date}_${slot}_${type}`;
      bookedMap[key] = item.count;
    });

    res.json({
      success: true,
      bookedMap,
      capacityLimits: CAPACITY_LIMITS,
      slots: generateSlots(),
      dates: ['24 JUL', '25 JUL', '26 JUL']
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch single registration by Reference ID (Supports both root & nested lookup)
app.get('/api/registration/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const registration = await Registration.findOne({
      $or: [
        { 'sessionDetails.referenceId': referenceId },
        { referenceId: referenceId }
      ]
    });

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
    const { 
      name, 
      contact, 
      email, 
      age, 
      gender, 
      date, 
      timeSlot, 
      registrationType = 'participant', 
      fcmToken 
    } = req.body;

    const normalizedType = (registrationType || 'participant').toLowerCase().trim();
    const cleanDate = date ? date.trim() : '';
    const cleanTimeSlot = timeSlot ? timeSlot.trim() : '';

    // 1. Capacity Check
    const currentCount = await Registration.countDocuments({
      'sessionDetails.date': cleanDate,
      'sessionDetails.timeSlot': cleanTimeSlot,
      $or: [
        { registrationType: normalizedType },
        { registrationType: { $exists: false } }
      ],
      status: 'confirmed'
    });

    const limit = CAPACITY_LIMITS[normalizedType] ?? 1;

    if (currentCount >= limit) {
      return res.status(400).json({ 
        error: `This slot is fully booked for ${normalizedType}s (${currentCount}/${limit}).` 
      });
    }

    // 2. Generate Reference ID (Ensure it's never null)
    const referenceId = 'PUMA' + Math.floor(100000 + Math.random() * 900000);

    let formattedContact = contact ? contact.toString().trim() : '';
    if (formattedContact && !formattedContact.startsWith('+')) {
      formattedContact = `+91${formattedContact.replace(/\D/g, '')}`;
    }

    // 3. Save Registration
    const newReg = new Registration({
      name: name?.trim(),
      contact: formattedContact,
      email: email?.trim().toLowerCase(),
      age: Number(age),
      gender: gender?.trim(),
      registrationType: normalizedType,
      referenceId: referenceId,  
      sessionDetails: { 
        date: cleanDate, 
        timeSlot: cleanTimeSlot,
      },
      fcmToken: fcmToken || null,
      status: 'confirmed'
    });

    await newReg.save();

    console.log(`✅ Registration saved with Ref: ${referenceId}`);

    res.status(201).json({
      message: 'Registered successfully',
      referenceId,
      data: newReg
    });

    // Background Notifications (unchanged)
    (async () => {
      console.log(`📨 Starting background notifications for ${referenceId}`);

      if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
        try {
          const emailData = {
            to: email,
            from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'PUMA X HYROX' },
            subject: '⚡ Your PUMA Registration Pass',
            html: `
              <!DOCTYPE html>
              <html>
              <body style="font-family: Arial, sans-serif; background-color: #f2f6f3; padding: 20px;">
                <div style="max-width: 580px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px;">
                  <h2 style="color: #0f5c53;">PUMA X HYROX</h2>
                  <p>Hi <strong>${name}</strong>,</p>
                  <p>Your registration as a <strong>${normalizedType.toUpperCase()}</strong> is confirmed!</p>
                  <div style="background: #e8f0eb; padding: 16px; border-radius: 8px; border: 2px dashed #0f5c53;">
                    <p><strong>REF ID:</strong> ${referenceId}</p>
                    <p><strong>TYPE:</strong> ${normalizedType.toUpperCase()}</p>
                    <p><strong>DATE:</strong> ${cleanDate}</p>
                    <p><strong>TIME:</strong> ${cleanTimeSlot}</p>
                  </div>
                </div>
              </body>
              </html>
            `
          };
          await sgMail.send(emailData);
          console.log(`✅ Email sent to ${email}`);
        } catch (err) {
          console.error('❌ SendGrid Error:', err.message);
        }
      }

      if (fcmToken && firebaseInitialized) {
        try {
          await getMessaging().send({
            token: fcmToken,
            notification: {
              title: '⚡ PUMA X HYROX Registration Confirmed!',
              body: `Hi ${name}, your spot as a ${normalizedType} is locked in! Ref: ${referenceId}`,
            }
          });
        } catch (err) {
          console.error('❌ FCM Error:', err.message);
        }
      }
    })();

  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: err.message });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
            