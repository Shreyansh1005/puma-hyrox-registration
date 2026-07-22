import React, { useState, useEffect } from 'react';
import './theme.css';

function Preloader({ onComplete }) {
  const [count, setCount] = useState(3);
  const [statusText, setStatusText] = useState('CALIBRATING TRACK');
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev === 3) {
          setStatusText('WARMING TIRES');
          return 2;
        }
        if (prev === 2) {
          setStatusText('GREEN LIGHT');
          return 1;
        }
        if (prev === 1) {
          clearInterval(timer);
          setFadingOut(true);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 400);
          return 0;
        }
        return prev;
      });
    }, 600);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className={`preloader-overlay ${fadingOut ? 'fade-out' : ''}`}>
      <div className="preloader-content">
        <img src="/media/PUMA_CAT_LOGO_PNG.png" alt="PUMA" className="preloader-logo" />
        
        <div className="countdown-number">
          {count > 0 ? `0${count}` : 'GO!'}
        </div>

        <div className="racing-gauge-bar">
          <div className="gauge-fill" style={{ width: `${((4 - count) / 3) * 100}%` }} />
        </div>

        <span className="preloader-status racing-font">{statusText}</span>
      </div>
    </div>
  );
}

export default Preloader;