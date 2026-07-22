import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import RaceTrack from './RaceTrack';
import './theme.css';

function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const passRef = useRef(null);

  // Read referenceId and full registration object passed from Review.jsx navigation
  const referenceId = location.state?.referenceId || 'PUMA-HYROX-849201';
  const initialData = location.state?.registrationData || null;

  const [regData, setRegData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);

  // Fetch registration directly from MongoDB if data isn't in navigation state
  useEffect(() => {
    if (!initialData && referenceId) {
      axios.get(`https://puma-hyrox-backend.onrender.com/api/registration/${referenceId}`)
        .then((res) => {
          setRegData(res.data);
        })
        .catch((err) => {
          console.error('Error fetching registration from MongoDB:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [initialData, referenceId]);

  const handleDownloadPDF = async () => {
    const element = passRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#0d1d19'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const imgWidth = pdfWidth - 30;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 15, 25, imgWidth, imgHeight);
      pdf.save(`PUMA_HYROX_PASS_${referenceId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Could not download pass. Please try again.');
    }
  };

  return (
    <div className="app-shell">
      <main className="form-container">
        <RaceTrack stage={5} />

        <div className="glass-card mt-16 center">
          <span className="eyebrow">FINISH LINE CROSSED</span>
          <h2 className="station-title mt-8">Booking Confirmed!</h2>
          <p className="lede">
            You're locked in for PUMA X HYROX. Confirmation has been sent to your email & SMS.
          </p>

          {/* Styled Printable Pass Card */}
          <div 
            ref={passRef} 
            className="race-pass-card mt-24" 
            style={{
              padding: '28px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0d1d19 0%, #08120e 100%)',
              border: '2px solid #13a38a',
              color: '#ffffff',
              textAlign: 'left',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <div 
              className="pass-header" 
              style={{ 
                display: 'flex', 
                justify: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)', 
                paddingBottom: '14px' 
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '1px', color: '#13a38a' }}>
                PUMA X HYROX 2026
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8, letterSpacing: '1px' }}>
                ENTRY PASS
              </span>
            </div>

            {loading ? (
              <div className="mt-20 center" style={{ color: '#13a38a' }}>Fetching pass data from database…</div>
            ) : (
              <div className="pass-body mt-20" style={{ fontSize: '15px', lineHeight: '2' }}>
                <div><strong style={{ color: '#13a38a' }}>Participant:</strong> {regData?.name || '—'}</div>
                <div><strong style={{ color: '#13a38a' }}>Date:</strong> {regData?.sessionDetails?.date || regData?.date || '—'}</div>
                <div><strong style={{ color: '#13a38a' }}>Time Slot:</strong> {regData?.sessionDetails?.timeSlot || regData?.timeSlot || '—'}</div>
                <div><strong style={{ color: '#13a38a' }}>Contact:</strong> {regData?.contact || '—'}</div>
                <div style={{ wordBreak: 'break-all' }}>
                  <strong style={{ color: '#13a38a' }}>Email:</strong> {regData?.email || '—'}
                </div>
              </div>
            )}

            <div 
              className="pass-footer mt-24" 
              style={{ 
                borderTop: '1px dashed rgba(255,255,255,0.2)', 
                paddingTop: '16px',
                textAlign: 'center' 
              }}
            >
              <div style={{ fontSize: '11px', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Reference ID
              </div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#3bf3a6', letterSpacing: '2px', marginTop: '4px' }}>
                {referenceId}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-32" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="btn btn-primary race-btn btn-block" 
              onClick={handleDownloadPDF}
            >
              📥 DOWNLOAD PASS (PDF)
            </button>

            <button 
              className="btn btn-secondary race-btn btn-block" 
              onClick={() => {
                localStorage.clear();
                navigate('/');
              }}
            >
              RETURN TO HOME
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Success;