const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios'); // Required for Fast2SMS API requests
const { ServerApiVersion } = require('mongodb');

const app = express();
app.use(cors({
  origin: '*', // Allows requests from Vercel and localhost
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI is not defined in your .env file.");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})
  .then(() => console.log('MongoDB Atlas connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

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
    status: { type: String, default: 'confirmed', enum: ['confirmed', 'cancelled'] },
  },
  { timestamps: true }
);

const Registration = mongoose.model('Registration', registrationSchema);

app.post('/api/register', async (req, res) => {
  try {
    const { name, contact, email, age, gender, date, timeSlot } = req.body;
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
    });

    await newReg.save();

    // ----------------------------------------------------
    // 1. EMAIL NOTIFICATION (Nodemailer)
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
        console.log(`Confirmation email sent successfully to ${email}`);
      } catch (mailErr) {
        console.error('Failed to send email:', mailErr.message);
      }
    }

    // ----------------------------------------------------
    // 2. SMS NOTIFICATION (Fast2SMS API)
    // ----------------------------------------------------
    // ----------------------------------------------------
// 2. SMS NOTIFICATION (Twilio)
// ----------------------------------------------------
// ----------------------------------------------------
// 2. SMS NOTIFICATION (Twilio)
// ----------------------------------------------------
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // Format recipient number to E.164 (+91 for India)
  const formattedContact = contact.startsWith('+') 
    ? contact 
    : `+91${contact.replace(/[^0-9]/g, '').slice(-10)}`;

  try {
    const message = await client.messages.create({
      body: `Hi ${name}, your PUMA X HYROX registration is confirmed! Ref ID: ${referenceId}, Date: ${date}, Slot: ${timeSlot}.`,
      from: process.env.TWILIO_PHONE_NUMBER, // Must be your Twilio number starting with +
      to: formattedContact                  // Recipient number starting with +91...
    });
    console.log(`SMS sent successfully to ${formattedContact}! SID: ${message.sid}`);
  } catch (smsErr) {
    console.error('Failed to send SMS via Twilio:', smsErr.message);
  }
}else {
      console.warn('FAST2SMS_API_KEY missing in .env file. SMS notification skipped.');
    }

    res.status(201).json({
      message: 'Registered successfully',
      referenceId
    });
  } catch (err) {
    console.error('Registration Endpoint Error:', err);
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));