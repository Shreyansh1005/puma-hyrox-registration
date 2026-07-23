import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';

const DEFAULT_DATES = ['24 JUL', '25 JUL', '26 JUL'];

const checkIsDatePast = (dateStr) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [day, monthStr] = dateStr.trim().split(' ');
  const monthMap = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

  const slotDate = new Date(now.getFullYear(), monthMap[monthStr?.toUpperCase()], parseInt(day, 10));
  return slotDate < today;
};

function SlotSelection() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialFormState = location.state?.formData || JSON.parse(localStorage.getItem('regData') || '{}');

  const [formData, setFormData] = useState({
    registrationType: initialFormState.registrationType || 'participant',
    name: initialFormState.name || '',
    contact: initialFormState.contact || '',
    email: initialFormState.email || '',
    age: initialFormState.age || '',
    gender: initialFormState.gender || '',
  });

  const [dates, setDates] = useState(DEFAULT_DATES);
  const [allSlots, setAllSlots] = useState([]);
  const [bookedMap, setBookedMap] = useState({});
  const [capacityLimits, setCapacityLimits] = useState({ participant: 1, spectator: 1 });

  const [selectedDate, setSelectedDate] = useState('25 JUL');
  const [selectedTime, setSelectedTime] = useState('');
  const [activeTab, setActiveTab] = useState('afternoon');
  const [loadingSlots, setLoadingSlots] = useState(true);

  const fetchSlotData = async () => {
    try {
      setLoadingSlots(true);
      const res = await axios.get('https://puma-hyrox-backend.onrender.com/api/slots');

      if (res.data?.dates?.length) setDates(res.data.dates);
      if (res.data?.capacityLimits) setCapacityLimits(res.data.capacityLimits);
      if (res.data?.bookedMap) setBookedMap(res.data.bookedMap);

      if (res.data?.slots?.length) {
        const formatted = res.data.slots.map((slotStr) => {
          const timePart = slotStr.split(' - ')[0];
          let [time, modifier] = timePart.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          return { label: slotStr, startMin: hours * 60 + minutes };
        });
        setAllSlots(formatted);
      }
    } catch (err) {
      console.error('Error fetching slot data:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchSlotData();
  }, []);

  // Auto-select first future date
  useEffect(() => {
    const validDates = dates.filter(d => !checkIsDatePast(d));
    if (validDates.length > 0 && checkIsDatePast(selectedDate)) {
      setSelectedDate(validDates[0]);
    }
  }, [dates]);

  const isSlotAvailable = (date, slotObj) => {
    // Past dates - everything unavailable
    if (checkIsDatePast(date)) return false;

    // Today - disable past time slots
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    if (date === selectedDate && slotObj.startMin <= currentMin) {
      return false;
    }

    // Capacity check
    const userType = (formData.registrationType || 'participant').toLowerCase().trim();
    const key = `${date.trim()}_${slotObj.label.trim()}_${userType}`;
    const count = bookedMap[key] || 0;
    const limit = capacityLimits[userType] ?? 1;

    return count < limit;
  };

  const filteredSlots = useMemo(() => allSlots, [allSlots]);

  const handleNext = () => {
    if (!selectedDate || !selectedTime) return;
    const fullRegData = { ...formData, date: selectedDate, timeSlot: selectedTime };
    localStorage.setItem('fullRegData', JSON.stringify(fullRegData));
    navigate('/review', { state: { fullRegData } });
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        <RaceTrack stage={3} />

        <div className="glass-card mt-16 center">
          <span className="eyebrow">STATION 02</span>
          <h2 className="station-title mt-8">Pick Your Slot</h2>

          <div className="mt-16 text-left">
            <label className="field-label">Registration Type</label>
            <select className="field select-field" value={formData.registrationType} disabled>
              <option value="participant">🏃 PARTICIPANT</option>
              <option value="spectator">👀 SPECTATOR</option>
            </select>
            <small style={{color: '#666', fontSize: '0.8rem'}}>Type cannot be changed after Station 01</small>
          </div>

          {/* Date Picker */}
          <div className="mt-24">
            <label className="field-label">Select Date (July 2026)</label>
            <div className="chip-grid center-grid">
              {dates.map((d) => {
                const isPast = checkIsDatePast(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isPast}
                    className={`chip ${selectedDate === d ? 'selected' : ''} ${isPast ? 'disabled-soldout' : ''}`}
                    onClick={() => !isPast && setSelectedDate(d)}
                  >
                    {d} {isPast && '(CLOSED)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots */}
          <div className="mt-24">
            <label className="field-label">Select Time Slot</label>
            <div className="slot-tabs">
              <button className={`tab-btn ${activeTab === 'morning' ? 'active' : ''}`} onClick={() => setActiveTab('morning')}>🌅 Morning</button>
              <button className={`tab-btn ${activeTab === 'afternoon' ? 'active' : ''}`} onClick={() => setActiveTab('afternoon')}>☀️ Afternoon</button>
              <button className={`tab-btn ${activeTab === 'evening' ? 'active' : ''}`} onClick={() => setActiveTab('evening')}>🌙 Evening</button>
            </div>

            <div className="compact-slot-grid mt-16">
              {loadingSlots ? (
                <p className="muted-text">Checking slot availability…</p>
              ) : filteredSlots.length > 0 ? (
                filteredSlots.map((t) => {
                  const isAvailable = isSlotAvailable(selectedDate, t);
                  return (
                    <button
                      key={t.label}
                      type="button"
                      disabled={!isAvailable}
                      className={`chip slot-chip ${selectedTime === t.label ? 'selected' : ''} ${!isAvailable ? 'disabled-soldout' : ''}`}
                      onClick={() => isAvailable && setSelectedTime(t.label)}
                    >
                      <span className="slot-time">{t.label}</span>
                      <span className="slot-badge">
                        {isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="muted-text">No slots available for this time period.</p>
              )}
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