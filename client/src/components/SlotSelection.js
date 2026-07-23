import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import RaceTrack from './RaceTrack';
import './theme.css';

const DEFAULT_DATES = ['24 JUL', '25 JUL', '26 JUL'];

const MONTH_MAP = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5, JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

const parseSlotDate = (dateStr) => {
  const now = new Date();
  const [day, monthStr] = dateStr.trim().split(' ');
  return new Date(now.getFullYear(), MONTH_MAP[monthStr?.toUpperCase()], parseInt(day, 10));
};

// Kept for reference / potential future use, but selection logic no longer
// relies on "past" alone — see checkIsSelectableDate below.
const checkIsDatePast = (dateStr) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parseSlotDate(dateStr) < today;
};

// NEW: only "today" is a selectable/bookable date. Anything before or
// after today is disabled — this is the piece that was missing before.
const checkIsSelectableDate = (dateStr) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slotDate = parseSlotDate(dateStr);
  return slotDate.getTime() === today.getTime();
};

const getTodayLabel = (dates) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dates.find((d) => parseSlotDate(d).getTime() === today.getTime());
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

  // No longer hardcoded to '25 JUL' — starts empty and gets set to
  // today's date once we know what "today" actually is against `dates`.
  const [selectedDate, setSelectedDate] = useState('');
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

  // Auto-select TODAY's date only. If today isn't in the `dates` list at
  // all (event not running today), nothing gets selected and the date
  // chips are all disabled.
  useEffect(() => {
    const todayLabel = getTodayLabel(dates);
    if (todayLabel && selectedDate !== todayLabel) {
      setSelectedDate(todayLabel);
    } else if (!todayLabel) {
      setSelectedDate('');
    }
  }, [dates]);

  const isSlotAvailable = (date, slotObj) => {
    // Hard gate: only today's date can ever have available slots,
    // regardless of capacity numbers.
    if (!checkIsSelectableDate(date)) return false;

    // Disable past time slots within today
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (slotObj.startMin <= currentMin) return false;

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
                const isSelectable = checkIsSelectableDate(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!isSelectable}
                    className={`chip ${selectedDate === d ? 'selected' : ''} ${!isSelectable ? 'disabled-soldout' : ''}`}
                    onClick={() => isSelectable && setSelectedDate(d)}
                  >
                    {d} {!isSelectable && '(CLOSED)'}
                  </button>
                );
              })}
            </div>
            {!getTodayLabel(dates) && (
              <p className="muted-text mt-8">Registration is not open today.</p>
            )}
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
              ) : !selectedDate ? (
                <p className="muted-text">No slots available today.</p>
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