import React from 'react';
import './theme.css';

const STAGES = ['START', 'DETAILS', 'SLOT', 'REVIEW', 'FINISH'];

function RaceTrack({ stage }) {
  const fillPercent = ((stage - 1) / (STAGES.length - 1)) * 100;

  return (
    <div className="stepper-container">
      <div className="stepper-wrapper">
        <div className="stepper-track-line">
          <div
            className="stepper-track-progress"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {STAGES.map((label, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < stage;
          const isActive = stepNum === stage;

          return (
            <div
              key={label}
              className={`step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="step-circle">
                {isCompleted ? '✓' : stepNum}
              </div>
              <span className="step-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RaceTrack;