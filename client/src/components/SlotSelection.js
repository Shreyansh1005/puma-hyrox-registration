import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';

function SlotSelection() {
  const [slots, setSlots] = useState({ dates: [], slots: [] });
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fallback mock dates/slots if local API is unready
    axios.get('http://localhost:5000/api/slots')
      .then(res => setSlots(res.data))
      .catch(() => {
        setSlots({
          dates: ['OCT 24', 'OCT 25', 'OCT 26'],
          slots: ['08:00 AM', '10:30 AM', '02:00 PM', '04:30 PM']
        });
      });
  }, []);

  const handleNext = () => {
    const regData = JSON.parse(localStorage.getItem('regData') || '{}');
    const fullData = { ...regData, date: selectedDate, timeSlot: selectedTime };
    localStorage.setItem('fullRegData', JSON.stringify(fullData));
    navigate('/review');
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        <RaceTrack stage={3} />

        <div className="glass-card mt-16 center">
          <span className="eyebrow">STATION 02</span>
          <h2 className="station-title mt-8">Pick Your Slot</h2>
          <p className="lede">Choose a date and time — spots fill fast on race weekend.</p>

          <div className="mt-24">
            <label className="field-label">Select Date</label>
            <div className="chip-grid">
              {slots.dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${selectedDate === d ? 'selected' : ''}`}
                  onClick={() => setSelectedDate(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-24">
            <label className="field-label">Select Time Slot</label>
            <div className="chip-grid">
              {slots.slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${selectedTime === t ? 'selected' : ''}`}
                  onClick={() => setSelectedTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-32">
            <button
              className="btn btn-primary race-btn btn-block"
              disabled={!selectedDate || !selectedTime}
              onClick={handleNext}
            >
              Review Registration →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SlotSelection;