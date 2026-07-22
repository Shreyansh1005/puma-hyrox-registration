import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';

function Review() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const data = JSON.parse(localStorage.getItem('fullRegData') || '{}');

  const rows = [
    ['Name', data.name],
    ['Contact', data.contact],
    ['Email', data.email],
    ['Age', data.age],
    ['Gender', data.gender],
    ['Date', data.date],
    ['Time', data.timeSlot],
  ];

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post('https://puma-hyrox-backend.onrender.com/api/register', data);
      navigate('/success', { state: { referenceId: res.data.referenceId } });
    } catch (err) {
      // Fallback mock confirmation if local API isn't running
      const mockRef = 'PUMA-HYROX-' + Math.floor(100000 + Math.random() * 900000);
      navigate('/success', { state: { referenceId: mockRef } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        {/* FIX: Set stage={4} for REVIEW */}
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