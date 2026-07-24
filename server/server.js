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
const ExcelJS = require('exceljs');

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
// TWILIO INITIALIZATION
// ----------------------------------------------------
// NEW: this was the missing piece. `twilio` was required at the top of
// the file but never turned into a client and never called anywhere,
// so no SMS could ever be sent regardless of what env vars you set.
let twilioClient = null;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER; // e.g. +1XXXXXXXXXX

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('⚡ Twilio SMS Service initialized!');
  } catch (twErr) {
    console.error('❌ Twilio initialization error:', twErr.message);
  }
} else {
  console.warn('⚠️ Twilio env vars missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) — SMS disabled.');
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
// HELPER: Get capacity limit based on date + time (for today's remaining slots)
// ----------------------------------------------------
// FIXED VERSION:
// - Today (24 JUL): slots at/before 4:35 PM stay at original limits (12/5).
//   Slots strictly AFTER 4:35 PM get the increased limits (17/10),
//   regardless of what time it is right now when someone loads the page
//   or registers (the cutoff is a fixed point in time, not "current time").
// - Tomorrow onward (25 JUL, 26 JUL): always back to original limits (12/5).
function getCapacityLimit(registrationType, date, timeSlot) {
  const normalizedType = (registrationType || 'participant').toLowerCase().trim();
  const today = '24 JUL'; // Today is 24 JUL 2026

  const originalParticipant = 12;
  const originalSpectator = 5;
  const increasedParticipant = 17;
  const increasedSpectator = 10;

  // Any date other than today (25 JUL, 26 JUL, ...) always uses original limits.
  if (date !== today) {
    return normalizedType === 'participant' ? originalParticipant : originalSpectator;
  }

  // No time slot given (shouldn't normally happen) -> original limits.
  if (!timeSlot) {
    return normalizedType === 'participant' ? originalParticipant : originalSpectator;
  }

  // Fixed cutoff: 4:35 PM today, expressed in minutes from midnight.
  // 4:35 PM = 16*60 + 35 = 995
  const CUTOFF_MINUTES = 16 * 60 + 35;

  // Parse slot start time (e.g., "04:40 PM - 04:55 PM" -> "04:40 PM")
  const slotStartStr = timeSlot.split(' - ')[0].trim();
  let slotHour = parseInt(slotStartStr.split(':')[0]);
  const slotMinute = parseInt(slotStartStr.split(':')[1].split(' ')[0]);
  const isPM = slotStartStr.toUpperCase().includes('PM');

  if (isPM && slotHour !== 12) slotHour += 12;
  if (!isPM && slotHour === 12) slotHour = 0;

  const slotTotalMinutes = slotHour * 60 + slotMinute;

  // Slots strictly after 4:35 PM today get the increased limit.
  // Slots at or before 4:35 PM keep the original limit.
  if (slotTotalMinutes > CUTOFF_MINUTES) {
    return normalizedType === 'participant' ? increasedParticipant : increasedSpectator;
  } else {
    return normalizedType === 'participant' ? originalParticipant : originalSpectator;
  }
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

    // NEW: Per-slot dynamic capacity map, so the frontend knows the REAL
    // limit for each date/slot/type combo (e.g. 17 instead of 12 for
    // evening slots after 4:35 PM today), instead of relying on the
    // single static CAPACITY_LIMITS object which can't vary by time.
    const dates = ['24 JUL', '25 JUL', '26 JUL'];
    const slotsList = generateSlots();
    const types = ['participant', 'spectator'];

    const capacityMap = {};
    dates.forEach(date => {
      slotsList.forEach(slot => {
        types.forEach(type => {
          const key = `${date}_${slot}_${type}`;
          capacityMap[key] = getCapacityLimit(type, date, slot);
        });
      });
    });

    res.json({
      success: true,
      bookedMap,
      capacityLimits: CAPACITY_LIMITS, // Kept for backwards compatibility with older frontend builds
      capacityMap,                     // NEW: use this per-slot value instead of the static one above
      slots: slotsList,
      dates
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

    // 1. Capacity Check - Use dynamic limit (increased for remaining slots today + future days)
    const limit = getCapacityLimit(normalizedType, cleanDate, cleanTimeSlot);

    const currentCount = await Registration.countDocuments({
      'sessionDetails.date': cleanDate,
      'sessionDetails.timeSlot': cleanTimeSlot,
      $or: [
        { registrationType: normalizedType },
        { registrationType: { $exists: false } }
      ],
      status: 'confirmed'
    });

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

    // Background Notifications
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
          if (err.response && err.response.body) {
            console.error('❌ SendGrid Error Details:', JSON.stringify(err.response.body, null, 2));
        }}
      }

      // NEW: this block is the actual fix. Previously `twilio` was
      // imported but never used anywhere, so no SMS was ever sent no
      // matter what env vars existed. Now, if the client initialized
      // successfully above and we have a contact number, we send one.
      if (twilioClient && formattedContact) {
        try {
          const smsResult = await twilioClient.messages.create({
            from: TWILIO_PHONE_NUMBER,
            to: formattedContact,
            body: `PUMA X HYROX: Hi ${name}, your registration as a ${normalizedType.toUpperCase()} is confirmed! Ref: ${referenceId} | ${cleanDate} | ${cleanTimeSlot}`
          });
          console.log(`✅ SMS sent to ${formattedContact} (SID: ${smsResult.sid})`);
        } catch (err) {
          console.error('❌ Twilio SMS Error:', err.message);
        }
      } else if (!twilioClient) {
        console.warn('⚠️ Skipped SMS: Twilio client not initialized (check env vars).');
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

// ----------------------------------------------------
// ADMIN EXPORT: Download all registrations as an Excel file
// ----------------------------------------------------
// NEW. Protected by a shared secret key (ADMIN_EXPORT_KEY env var),
// passed as a query param: /api/admin/export?key=YOUR_SECRET
// Since there's no admin panel/login system, this is the simplest way
// to gate the endpoint so a random visitor can't just download every
// registrant's name/phone/email by guessing the URL.
app.get('/api/admin/export', async (req, res) => {
  try {
    const providedKey = req.query.key;
    const expectedKey = process.env.ADMIN_EXPORT_KEY;

    if (!expectedKey) {
      return res.status(500).json({ error: 'ADMIN_EXPORT_KEY is not configured on the server.' });
    }
    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized. Provide the correct ?key=... query parameter.' });
    }

    const registrations = await Registration.find({}).sort({ createdAt: -1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PUMA X HYROX Registration System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Registrations');

    sheet.columns = [
      { header: 'Reference ID', key: 'referenceId', width: 16 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Contact', key: 'contact', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Registration Type', key: 'registrationType', width: 18 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Time Slot', key: 'timeSlot', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Registered At', key: 'createdAt', width: 22 },
    ];

    // Bold header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0EB' }
    };

    registrations.forEach((r) => {
      sheet.addRow({
        referenceId: r.referenceId || '',
        name: r.name || '',
        contact: r.contact || '',
        email: r.email || '',
        age: r.age ?? '',
        gender: r.gender || '',
        registrationType: (r.registrationType || 'participant').toUpperCase(),
        date: r.sessionDetails?.date || '',
        timeSlot: r.sessionDetails?.timeSlot || '',
        status: r.status || '',
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      });
    });

    const filename = `puma-hyrox-registrations-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`📊 Admin export: ${registrations.length} registrations downloaded.`);
  } catch (err) {
    console.error('❌ Admin Export Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Minimal one-page admin download screen (no framework/build needed).
// Visit https://your-backend-url/admin, enter the key, click download.
app.get('/admin', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>PUMA X HYROX — Admin Export</title>
      <style>
        body {
          font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          background: #f2f6f3;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .card {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px 28px;
          max-width: 360px;
          width: 100%;
          box-shadow: 0 20px 45px -10px rgba(8,18,14,0.12);
          text-align: center;
        }
        h1 { font-size: 1.3rem; color: #0f5c53; margin: 0 0 8px; }
        p { color: #495e54; font-size: 0.9rem; margin: 0 0 20px; }
        input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid #d2ded6;
          font-size: 1rem;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        button {
          width: 100%;
          padding: 12px 20px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #65D2CA 0%, #AAC85C 50%, #F2CB40 100%);
          font-weight: 700;
          font-size: 0.95rem;
          text-transform: uppercase;
          cursor: pointer;
        }
        #status { margin-top: 14px; font-size: 0.85rem; color: #495e54; min-height: 18px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Registrations Export</h1>
        <p>Enter the admin key to download the full registration list as an Excel file.</p>
        <input type="password" id="adminKey" placeholder="Admin key" />
        <button onclick="downloadExport()">⬇ Download Excel Report</button>
        <div id="status"></div>
      </div>
      <script>
        function downloadExport() {
          const key = document.getElementById('adminKey').value.trim();
          const statusEl = document.getElementById('status');
          if (!key) {
            statusEl.textContent = 'Please enter the admin key.';
            return;
          }
          statusEl.textContent = 'Preparing download…';
          window.location.href = '/api/admin/export?key=' + encodeURIComponent(key);
          setTimeout(() => { statusEl.textContent = ''; }, 3000);
        }
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));