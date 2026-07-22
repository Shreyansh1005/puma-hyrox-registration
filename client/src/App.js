import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import RegistrationForm from './components/RegistrationForm';
import SlotSelection from './components/SlotSelection';
import Review from './components/Review';
import Success from './components/Success';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationForm />} />
        
        {/* Match both /slots and /select-slot so navigation never renders blank */}
        <Route path="/slots" element={<SlotSelection />} />
        <Route path="/select-slot" element={<SlotSelection />} />
        
        <Route path="/review" element={<Review />} />
        <Route path="/success" element={<Success />} />

        {/* Catch-all fallback redirect to avoid blank screens */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;