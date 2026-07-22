import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';

// Helper function to generate 15-min slots with 5-min intervals
const generateSlotTimes = () => {
  const times = [];
  let currentMinutes = 10 * 60; // 10:00 AM
  const endMinutes = 21 * 60;   // 09:00 PM

  const breakStart = 13 * 60;   // 01:00 PM
  const breakEnd = 14 * 60;     // 02:00 PM

  while (currentMinutes + 15 <= endMinutes) {
    const slotEndMinutes = currentMinutes + 15;

    // Skip 1 PM - 2 PM break
    if (currentMinutes >= breakStart && slotEndMinutes <= breakEnd) {
      currentMinutes = breakEnd;
      continue;
    }

    const formatTime = (totalMin) => {
      let hrs = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12 || 12;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
    };

    times.push({
      label: `${formatTime(currentMinutes)} - ${formatTime(slotEndMinutes)}`,
      startMin: currentMinutes
    });

    currentMinutes += 20; // 15 min slot + 5 min break
  }

  return times;
};

const DEFAULT_DATES = ['24 JUL', '25 JUL', '26 JUL'];
const DEFAULT_SLOTS = generateSlotTimes();

function SlotSelection() {
  const [dates, setDates] = useState(DEFAULT_DATES);
  const [allSlots, setAllSlots] = useState(DEFAULT_SLOTS);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [activeTab, setActiveTab] = useState('morning'); // 'morning' | 'afternoon' | 'evening'
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://localhost:5000/api/slots')
      .then(res => {
        if (res.data?.dates?.length) setDates(res.data.dates);
        if (res.data?.slots?.length) {
          // If server sends string array, map to objects with minutes for categorizing
          const formatted = res.data.slots.map(slotStr => {
            const timePart = slotStr.split(' - ')[0]; // e.g. "10:00 AM"
            let [time, modifier] = timePart.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            return { label: slotStr, startMin: hours * 60 + minutes };
          });
          setAllSlots(formatted);
        }
      })
      .catch(() => {
        setDates(DEFAULT_DATES);
        setAllSlots(DEFAULT_SLOTS);
      });
  }, []);

  // Filter slots dynamically based on selected tab
  const filteredSlots = useMemo(() => {
    return allSlots.filter(s => {
      if (activeTab === 'morning') return s.startMin < 12 * 60;                // 10 AM - 12 PM
      if (activeTab === 'afternoon') return s.startMin >= 12 * 60 && s.startMin < 17 * 60; // 12 PM - 5 PM
      if (activeTab === 'evening') return s.startMin >= 17 * 60;               // 5 PM - 9 PM
      return true;
    });
  }, [allSlots, activeTab]);

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

          {/* Date Picker */}
          <div className="mt-24">
            <label className="field-label">Select Date (July 2026)</label>
            <div className="chip-grid center-grid">
              {dates.map((d) => (
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

          {/* Time Filter Tabs */}
          <div className="mt-24">
            <label className="field-label">Select Time Slot</label>
            <div className="slot-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'morning' ? 'active' : ''}`}
                onClick={() => setActiveTab('morning')}
              >
                🌅 Morning
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'afternoon' ? 'active' : ''}`}
                onClick={() => setActiveTab('afternoon')}
              >
                ☀️ Afternoon
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'evening' ? 'active' : ''}`}
                onClick={() => setActiveTab('evening')}
              >
                🌙 Evening
              </button>
            </div>

            {/* Compact Time Slot Grid */}
            <div className="compact-slot-grid mt-16">
              {filteredSlots.length > 0 ? (
                filteredSlots.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={`chip slot-chip ${selectedTime === t.label ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(t.label)}
                  >
                    {t.label}
                  </button>
                ))
              ) : (
                <p className="muted-text">No slots available for this period.</p>
              )}
            </div>
          </div>

          {/* Action Button */}
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