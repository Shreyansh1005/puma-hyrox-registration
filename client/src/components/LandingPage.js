import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Preloader from './Preloader';
import './theme.css';

function LandingPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <Preloader onComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className="app-shell hero-mode">
      {/* Pure Animated Canvas Elements */}
      <div className="racing-bg-engine">
        <div className="speed-grid" />
        <div className="light-beams" />
        <div className="particle-field" />
      </div>

      <main className="landing-container">
        <header className="hero-header">
          {/* Main Hero Joint Logo */}
          <div className="main-logo-wrapper slam-anim">
            <img 
              src="/media/PumaXHyrox_Logo_PNG_01.png" 
              alt="PUMA x HYROX" 
              className="joint-hero-logo" 
            />
          </div>

          <h1 className="display display-impact mt-16 text-bang">
            WELCOME.<br />
            TO.<br />
            <span className="text-highlight">MEOW MART.</span>
          </h1>

          <p className="lede racing-sub slam-anim-delayed">
            Book your slot, skip the scramble, and get those carts ready. See you there.
          </p>
<div className="cta-group mt-32 slam-anim-delayed-2">
  <button className="btn btn-primary race-btn" onClick={() => navigate('/register')}>
    Begin Registration →
  </button>
</div>
        </header>
      </main>
    </div>
  );
}

export default LandingPage;