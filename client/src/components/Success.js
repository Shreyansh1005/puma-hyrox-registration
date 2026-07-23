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

  const referenceId = location.state?.referenceId;
  const initialData = location.state?.registrationData || null;

  const [regData, setRegData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (!initialData && referenceId) {
      axios.get(`https://puma-hyrox-backend.onrender.com/api/registration/${referenceId}`)
        .then((res) => setRegData(res.data))
        .catch((err) => console.error('Error fetching registration:', err))
        .finally(() => setLoading(false));
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
      pdf.save(`PUMA_HYROX_PASS_${referenceId || 'CONFIRMED'}.pdf`);
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
           Your slot for meowmart has been confirmed and sent to your email and sms. PLEASE ENSURE TO COME 10 MINS PRIOR TO SLOT
          </p>

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
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)', 
                paddingBottom: '14px' 
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '1px', color: '#13a38a' }}>
                MEOWART-DELHI
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {(regData?.registrationType || 'PARTICIPANT')} PASS
              </span>
            </div>

            {loading ? (
              <div className="mt-20 center" style={{ color: '#13a38a' }}>Fetching pass data from database…</div>
            ) : (
              <div className="pass-body mt-20" style={{ fontSize: '15px', lineHeight: '2' }}>
                <div>
                  <strong style={{ color: '#13a38a' }}>Type:</strong>{' '}
                  <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#3bf3a6' }}>
                    {regData?.registrationType || 'participant'}
                  </span>
                </div>
                <div><strong style={{ color: '#13a38a' }}>Name:</strong> {regData?.name || '—'}</div>
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
                {referenceId || regData?.referenceId || 'N/A'}
              </div>
            </div>
          </div>

          <div className="mt-32" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary race-btn btn-block" onClick={handleDownloadPDF}>
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