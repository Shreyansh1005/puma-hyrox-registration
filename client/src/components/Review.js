import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';
import { requestFcmToken } from '../firebase'; // Points to client/src/firebase.js

function Review() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);

  const data = JSON.parse(localStorage.getItem('fullRegData') || '{}');

  // 1. Fetch FCM Token automatically when component mounts
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await requestFcmToken();
        if (token) {
          console.log('✅ FCM Token attached to Review component:', token);
          setFcmToken(token);
        } else {
          console.warn('⚠️ FCM Token was null or permission was denied.');
        }
      } catch (err) {
        console.error('Error fetching FCM Token on mount:', err);
      }
    };

    fetchToken();
  }, []);

  const rows = [
    ['Name', data.name],
    ['Contact', data.contact],
    ['Email', data.email],
    ['Age', data.age],
    ['Gender', data.gender],
    ['Date', data.date],
    ['Time', data.timeSlot],
  ];

  // 2. Handle Form Confirmation
  const handleConfirm = async () => {
    setSubmitting(true);

    try {
      // Fallback: If fcmToken is not in state yet, attempt to fetch it one last time
      let activeToken = fcmToken;
      if (!activeToken) {
        activeToken = await requestFcmToken();
      }

      const payload = {
        name: data.name,
        contact: data.contact,
        email: data.email,
        age: Number(data.age), // Ensure age is sent as a Number matching Mongoose schema
        gender: data.gender,
        date: data.date,
        timeSlot: data.timeSlot,
        fcmToken: activeToken || null, // Key name matches req.body.fcmToken on server
      };

      console.log('Sending Registration Payload:', payload);

      const res = await axios.post('https://puma-hyrox-backend.onrender.com/api/register', payload);

      // Clear local storage after successful registration
      localStorage.removeItem('fullRegData');

      navigate('/success', { state: { referenceId: res.data.referenceId } });
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Registration failed. Please check the server logs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        <RaceTrack stage={4} />

        <div className="glass-card mt-16">
          <span className="eyebrow">STATION 03</span>
          <h2 className="station-title mt-8">Review Registration</h2>
          <p className="lede">Check everything before you lock it in.</p>

          <div className="summary-list mt-24">
            {rows.map(([label, value]) => (
              <div key={label} className="summary-row">
                <span className="summary-label">{label}</span>
                <span className="summary-value">{value || '—'}</span>
              </div>
            ))}
          </div>

          <div className="center mt-32">
            <button 
              className="btn btn-primary btn-block race-btn" 
              onClick={handleConfirm} 
              disabled={submitting}
            >
              {submitting ? 'LOCKING IN…' : 'CONFIRM BOOKING →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Review;