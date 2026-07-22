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
          <div className="logo-badge-group slam-anim">
            <img src="/media/PUMA_CAT_LOGO_PNG.png" alt="PUMA" className="brand-logo" />
            <span className="brand-divider">×</span>
            <span className="eyebrow racing-font">HYROX SERIES 2026</span>
          </div>

          <h1 className="display display-impact mt-16 text-bang">
            TRAIN.<br />
            RACE.<br />
            <span className="text-highlight">REPEAT.</span>
          </h1>

          <p className="lede racing-sub slam-anim-delayed">
            Lock in your station for the next PUMA X HYROX event. Two minutes to
            register, one race day to prove it.
          </p>

          <div className="cta-group mt-32 slam-anim-delayed-2">
            <button className="btn btn-primary btn-lg race-btn" onClick={() => navigate('/register')}>
              Begin Registration →
            </button>
          </div>
        </header>

        {/* Dynamic Graphic Hero Container */}
        <section className="hero-card-container mt-32 slam-anim-delayed-2">
          <div className="graphic-hero-card">
            <div className="hero-badge-strip">
              <span className="racing-font">LIVE TELEMETRY ACTIVE</span>
              <span className="pulse-dot" />
            </div>

            <div className="hero-graphic-center">
              <span className="huge-watermark">PUMA</span>
              <h2 className="station-title text-bang">HYROX ARENA</h2>
            </div>

            <div className="card-footer-strip">
              <span>STATION 01 / READY</span>
              <span>2026 EDITION</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;