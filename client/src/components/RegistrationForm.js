import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RaceTrack from './RaceTrack';
import './theme.css';

function RegistrationForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    age: '',
    gender: '',
    consent: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.contact) {
      alert('Please fill out all required details.');
      return;
    }
    if (!formData.consent) {
      alert('Please accept the consent terms.');
      return;
    }

    // Store registration data in localStorage
    localStorage.setItem('regData', JSON.stringify(formData));

    // Navigate to /slots
    navigate('/slots');
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        {/* Stage 2 for Details */}
        <RaceTrack stage={2} />

        <div className="glass-card mt-16">
          <span className="eyebrow">STATION 01</span>
          <h2 className="station-title mt-8">Your Details</h2>

          <form className="form-grid mt-24" onSubmit={handleSubmit}>
            <div className="form-group full-width">
              <label className="field-label">Full Name</label>
              <input
                type="text"
                name="name"
                className="field"
                placeholder="e.g. Aditi Sharma"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group full-width">
              <label className="field-label">Contact Number</label>
              <input
                type="tel"
                name="contact"
                className="field"
                placeholder="10-digit mobile number"
                value={formData.contact}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group full-width">
              <label className="field-label">Email</label>
              <input
                type="email"
                name="email"
                className="field"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group half-width">
              <label className="field-label">Age</label>
              <input
                type="number"
                name="age"
                className="field"
                placeholder="Age"
                value={formData.age}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group half-width">
              <label className="field-label">Gender</label>
              <select
                name="gender"
                className="field select-field"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group full-width consent-row mt-8">
              <input
                type="checkbox"
                id="consent"
                name="consent"
                checked={formData.consent}
                onChange={handleChange}
              />
              <label htmlFor="consent">
                I agree that PUMA India may collect and use this information to process my HYROX registration.
              </label>
            </div>

            <div className="full-width mt-24">
              <button type="submit" className="btn btn-primary btn-block race-btn">
                NEXT: SELECT SLOT →
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default RegistrationForm;