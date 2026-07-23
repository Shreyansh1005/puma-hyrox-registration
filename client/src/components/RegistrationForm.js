import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RaceTrack from './RaceTrack';
import './theme.css';

function RegistrationForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    rawContact: '',
    contact: '',
    email: '',
    age: '',
    gender: '',
    registrationType: 'participant', // Default to participant
    consent: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhoneChange = (e) => {
    // Restrict input strictly to digits and enforce exactly 10 digits maximum
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    const formatted = digitsOnly ? `+91${digitsOnly}` : '';

    setFormData((prev) => ({
      ...prev,
      rawContact: digitsOnly,
      contact: formatted
    }));
  };

  const validateEmail = (email) => {
    // Standard robust email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Mandatory Fields Check
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.rawContact.trim() ||
      !formData.age ||
      !formData.gender
    ) {
      alert('Please fill out all mandatory details marked with (*).');
      return;
    }

    // 2. Strict 10-Digit Mobile Number Validation
    if (formData.rawContact.length !== 10) {
      alert('Please enter a valid, complete 10-digit contact number.');
      return;
    }

    // 3. Strict Email Validation
    if (!validateEmail(formData.email.trim())) {
      alert('Please enter a valid email address (e.g., name@example.com).');
      return;
    }

    // 4. Terms Consent Check
    if (!formData.consent) {
      alert('Please accept the consent terms to proceed.');
      return;
    }

    // Save to local storage for downstream screens
    localStorage.setItem('regData', JSON.stringify(formData));
    navigate('/slots', { state: { formData } });
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        <RaceTrack stage={2} />

        <div className="glass-card mt-16">
          <span className="eyebrow">STATION 01</span>
          <h2 className="station-title mt-8">Your Details</h2>

          <form className="form-grid mt-24" onSubmit={handleSubmit} noValidate>
            {/* 1. Registration Type Dropdown */}
            <div className="form-group full-width">
              <label className="field-label">
                I am joining as <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <select
                name="registrationType"
                className="field select-field"
                value={formData.registrationType}
                onChange={handleChange}
                required
              >
                <option value="">Registration Type</option>
                <option value="participant">🏃 PARTICIPANT</option>
                <option value="spectator">👀 SPECTATOR</option>
              </select>
            </div>

            {/* 2. Full Name */}
            <div className="form-group full-width">
              <label className="field-label">
                Full Name <span style={{ color: '#e53e3e' }}>*</span>
              </label>
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

            {/* 3. Contact Number (Strict 10 Digits) */}
            <div className="form-group full-width">
              <label className="field-label">
                Contact Number (10 Digits) <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <div className="phone-group-container">
                <span className="phone-prefix-badge">🇮🇳 +91</span>
                <input
                  type="tel"
                  className="field phone-field-input"
                  placeholder="9876543210"
                  maxLength={10}
                  minLength={10}
                  pattern="[0-9]{10}"
                  value={formData.rawContact}
                  onChange={handlePhoneChange}
                  required
                />
              </div>
            </div>

            {/* 4. Email Address */}
            <div className="form-group full-width">
              <label className="field-label">
                Email Address <span style={{ color: '#e53e3e' }}>*</span>
              </label>
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

            {/* 5. Age */}
            <div className="form-group half-width">
              <label className="field-label">
                Age <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <input
                type="number"
                name="age"
                className="field"
                placeholder="Age"
                min={10}
                max={99}
                value={formData.age}
                onChange={handleChange}
                required
              />
            </div>

            {/* 6. Gender */}
            <div className="form-group half-width">
              <label className="field-label">
                Gender <span style={{ color: '#e53e3e' }}>*</span>
              </label>
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

            {/* Consent Checkbox */}
            {/* Consent Checkbox */}
<div className="form-group full-width consent-row mt-8">
  <input
    type="checkbox"
    id="consent"
    name="consent"
    checked={formData.consent}
    onChange={handleChange}
    required
  />
  <label htmlFor="consent">
    I agree to the storage and processing of my personal data by PUMA India and HYROX in accordance with the Privacy Policy and Terms & Conditions. <span style={{ color: '#e53e3e' }}>*</span>
  </label>
</div>

            {/* Submit Button */}
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