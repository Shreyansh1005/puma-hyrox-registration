import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';
import { requestFcmToken } from '../firebase';

function Review() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);

  // Read data passed directly from SlotSelection or fallback to storage
  const data = location.state?.fullRegData || JSON.parse(localStorage.getItem('fullRegData') || '{}');

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const token = await requestFcmToken();
        if (token) setFcmToken(token);
      } catch (err) {
        console.error('Error fetching FCM Token:', err);
      }
    };
    fetchToken();
  }, []);

  const rows = [
    ['Type', (data.registrationType || 'participant').toUpperCase()],
    ['Name', data.name],
    ['Contact', data.contact],
    ['Email', data.email],
    ['Age', data.age],
    ['Gender', data.gender],
    ['Date', data.date],
    ['Time Slot', data.timeSlot],
  ];

  const handleConfirm = async () => {
    setSubmitting(true);

    try {
      let activeToken = fcmToken || (await requestFcmToken());

     const payload = {
  name: data.name,
  contact: data.contact,
  email: data.email,
  age: Number(data.age),
  gender: data.gender,
  registrationType: data.registrationType || 'participant',   // ← Critical
  date: data.date,
  timeSlot: data.timeSlot,
  fcmToken: activeToken || null,
};

      const res = await axios.post('https://puma-hyrox-backend.onrender.com/api/register', payload);
      // const res = await axios.post('http://localhost:5000/api/register', payload);

      // Clear local cache upon success
      localStorage.removeItem('fullRegData');

      navigate('/success', { 
        state: { 
          referenceId: res.data.referenceId,
          registrationData: res.data.data
        } 
      });
    } catch (err) {
      console.error('Registration failed:', err);
      const serverMsg = err.response?.data?.error || 'Registration failed. Slot may have just been booked!';
      alert(serverMsg);
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
          <p className="lede">Check details before locking in your spot.</p>

          <div className="summary-list mt-24">
            {rows.map(([label, value]) => (
              <div key={label} className="summary-row">
                <span className="summary-label">{label}</span>
                <span className={`summary-value ${label === 'Type' ? 'badge-highlight' : ''}`}>
                  {value || '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="center mt-32 flex-gap">
            <button 
              className="btn btn-secondary race-btn"
              onClick={() => navigate('/slots', { state: { formData: data } })}
            >
              ← EDIT SLOT
            </button>
            
            <button 
              className="btn btn-primary race-btn btn-block" 
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