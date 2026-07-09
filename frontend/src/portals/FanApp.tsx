import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { translations, Language } from '../i18n/translations';
import { Send, AlertCircle } from 'lucide-react';

interface FanAppProps {
  lang: Language;
}

export default function FanApp({ lang }: FanAppProps) {
  const t = translations[lang];
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'gemini'; text: string }[]>([
    { sender: 'gemini', text: lang === 'hi' ? 'नमस्कार! मैं आपकी कैसे मदद कर सकता हूँ?' : lang === 'mr' ? 'नमस्कार! मी तुम्हाला कशी मदत करू शकतो?' : 'Hello! Welcome to the Stadium. How can I help you navigate today?' }
  ]);
  const [destination, setDestination] = useState<'restroom' | 'food' | 'seat' | null>(null);
  const [ticketStatus, setTicketStatus] = useState<'active' | 'scanned' | 'error'>('active');
  const [ticketData, setTicketData] = useState<any>(null);
  const [gates, setGates] = useState<any[]>([
    { name: 'Gate A', rate: 25, status: 'clear', wait: '3 mins' },
    { name: 'Gate B', rate: 110, status: 'congested', wait: '12 mins' },
    { name: 'Gate C', rate: 45, status: 'clear', wait: '5 mins' },
    { name: 'Gate D', rate: 160, status: 'critical', wait: '22 mins' }
  ]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Generate a mock ticket on startup
  useEffect(() => {
    axios.post('/api/tickets/create', {
      userId: 'user_fan_101',
      matchId: 'final_ipl_2026',
      seat: 'Block 3B, Row G, Seat 24',
      gate: 'Gate B'
    }).then(res => {
      setTicketData(res.data);
    }).catch(err => console.error('Error generating ticket:', err));
  }, []);

  // Poll gate stats for real-time updates
  useEffect(() => {
    const fetchGates = () => {
      axios.get('/api/forecasting/surge')
        .then(res => {
          const predictions = res.data.predictions;
          const mapped = predictions.map((p: any) => ({
            name: p.gate.replace('Gate', 'Gate '),
            rate: p.currentVelocity,
            status: p.trend,
            wait: p.currentVelocity > 100 ? '20 mins' : p.currentVelocity > 60 ? '12 mins' : '4 mins'
          }));
          setGates(mapped);
        }).catch(err => console.warn('Using fallback gate stats:', err.message));
    };

    fetchGates();
    const interval = setInterval(fetchGates, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const response = await axios.post('/api/gemini/chat', {
        prompt: userText,
        language: lang === 'hi' ? 'Hindi' : lang === 'mr' ? 'Marathi' : 'English'
      });
      setChatLog(prev => [...prev, { sender: 'gemini', text: response.data.response }]);
    } catch (err: any) {
      setChatLog(prev => [...prev, { sender: 'gemini', text: 'Sorry, I am having trouble connecting to Gemini.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const simulateGateScan = async () => {
    if (!ticketData) return;
    try {
      const response = await axios.post('/api/tickets/scan', {
        qrPayload: ticketData.payload
      });
      if (response.data.message === 'Access Granted') {
        setTicketStatus('scanned');
        // Trigger voice synthesis (Accessibility feature)
        speakAccess('Access Granted! Seat Block 3B. Enjoy the match.');
      }
    } catch (error) {
      setTicketStatus('error');
      speakAccess('Access Denied. Verification error.');
    }
  };

  const speakAccess = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '12px 0' }}>
      
      {/* LEFT COLUMN: Ticket & Wayfinding */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* SECURE KMS TICKET */}
        <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.yourTicket}</h3>
            <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
              {t.verifyNotice}
            </span>
          </div>

          {ticketData && (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {/* Custom Styled QR Block */}
              <div 
                style={{ 
                  width: '120px', 
                  height: '120px', 
                  backgroundColor: '#ffffff', 
                  padding: '8px', 
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gridTemplateRows: 'repeat(5, 1fr)',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                onClick={simulateGateScan}
              >
                {/* Simulated QR Code blocks */}
                <div style={{ background: '#000', gridArea: '1 / 1 / 3 / 3' }} />
                <div style={{ background: '#000', gridArea: '1 / 4 / 3 / 6' }} />
                <div style={{ background: '#000', gridArea: '4 / 1 / 6 / 3' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
                <div style={{ background: '#000' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Event: <b>IPL 2026 Grand Final</b></div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Seat: <b>{ticketData.seat}</b></div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gate: <b>{ticketData.gate}</b></div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button 
                    onClick={simulateGateScan} 
                    disabled={ticketStatus === 'scanned'}
                    style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      border: 'none', 
                      fontWeight: 600,
                      background: ticketStatus === 'scanned' ? 'var(--success-color)' : 'var(--primary-gradient)',
                      color: '#0b0f19',
                      cursor: ticketStatus === 'scanned' ? 'default' : 'pointer'
                    }}
                  >
                    {ticketStatus === 'scanned' ? t.scanApproved : t.simulateScan}
                  </button>
                  {ticketStatus === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--error-color)', gap: '4px' }}>
                      <AlertCircle size={20} />
                      <span style={{ fontSize: '0.8rem' }}>{t.scanFailed}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MAP & WAYFINDING */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.wayfinding}</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button 
              className="glass-panel" 
              onClick={() => setDestination('seat')}
              style={{ flex: 1, padding: '8px', border: destination === 'seat' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', color: '#fff', cursor: 'pointer' }}
            >
              My Seat (3B)
            </button>
            <button 
              className="glass-panel" 
              onClick={() => setDestination('restroom')}
              style={{ flex: 1, padding: '8px', border: destination === 'restroom' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', color: '#fff', cursor: 'pointer' }}
            >
              Restrooms
            </button>
            <button 
              className="glass-panel" 
              onClick={() => setDestination('food')}
              style={{ flex: 1, padding: '8px', border: destination === 'food' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', color: '#fff', cursor: 'pointer' }}
            >
              Food Zone A
            </button>
          </div>

          {/* Interactive SVG Stadium Indoor Map */}
          <div style={{ background: '#0e1422', borderRadius: '12px', border: '1px solid var(--border-color)', height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="220" height="220" viewBox="0 0 200 200">
              {/* Outer boundary of the stadium */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="#252d42" strokeWidth="6" />
              {/* Inner pitch */}
              <rect x="75" y="65" width="50" height="70" rx="10" fill="none" stroke="#00f5d4" strokeWidth="2" strokeOpacity="0.4" />
              
              {/* Gates */}
              <circle cx="100" cy="10" r="6" fill="#ff0055" /> {/* Gate A */}
              <text x="100" y="24" fill="#ff0055" fontSize="8" textAnchor="middle">Gate A</text>
              
              <circle cx="190" cy="100" r="6" fill="#ff9f1c" /> {/* Gate B */}
              <text x="172" y="103" fill="#ff9f1c" fontSize="8" textAnchor="middle">Gate B</text>

              <circle cx="100" cy="190" r="6" fill="#00f5d4" /> {/* Gate C */}
              <text x="100" y="184" fill="#00f5d4" fontSize="8" textAnchor="middle">Gate C</text>

              <circle cx="10" cy="100" r="6" fill="#00f5d4" /> {/* Gate D */}
              <text x="28" y="103" fill="#00f5d4" fontSize="8" textAnchor="middle">Gate D</text>

              {/* Wayfinding Targets */}
              <g transform="translate(145, 60)" style={{ cursor: 'pointer' }}>
                <rect x="0" y="0" width="24" height="24" rx="4" fill="rgba(0, 242, 254, 0.1)" stroke="var(--primary-color)" strokeWidth="1" />
                <text x="12" y="15" fill="#fff" fontSize="8" textAnchor="middle">3B</text>
              </g>
              
              <g transform="translate(130, 140)">
                <circle cx="10" cy="10" r="8" fill="rgba(0, 245, 212, 0.1)" stroke="#00f5d4" strokeWidth="1" />
                <text x="10" y="13" fill="#00f5d4" fontSize="7" textAnchor="middle">wc</text>
              </g>

              <g transform="translate(50, 45)">
                <circle cx="10" cy="10" r="8" fill="rgba(255, 159, 28, 0.1)" stroke="#ff9f1c" strokeWidth="1" />
                <text x="10" y="13" fill="#ff9f1c" fontSize="7" textAnchor="middle">FD</text>
              </g>

              {/* Wayfinding Paths depending on selected checkpoint */}
              {destination === 'seat' && (
                <path 
                  d="M 190 100 Q 180 60 145 60" 
                  fill="none" 
                  stroke="var(--primary-color)" 
                  strokeWidth="3" 
                  className="wayfinding-path" 
                />
              )}
              {destination === 'restroom' && (
                <path 
                  d="M 190 100 Q 180 120 138 140" 
                  fill="none" 
                  stroke="#00f5d4" 
                  strokeWidth="3" 
                  className="wayfinding-path" 
                />
              )}
              {destination === 'food' && (
                <path 
                  d="M 190 100 Q 100 20 60 45" 
                  fill="none" 
                  stroke="#ff9f1c" 
                  strokeWidth="3" 
                  className="wayfinding-path" 
                />
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Chatbot & Congestion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* GATE CONGESTION STATUS */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.gateCongestion}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {gates.map((g, i) => {
              const statusColor = g.status === 'critical' ? 'var(--error-color)' : g.status === 'congested' ? 'var(--warning-color)' : 'var(--success-color)';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', borderLeft: `4px solid ${statusColor}` }}>
                  <div style={{ fontWeight: 600 }}>{g.name}</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Velocity: <b>{g.rate} scans/m</b></div>
                    <div style={{ color: statusColor, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                      {t.wait}: {g.wait}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GEMINI CHATBOX */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{t.chatAssistant}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-color)' }}>Gemini 1.5</span>
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px' }}>
            {chatLog.map((log, index) => (
              <div 
                key={index} 
                style={{ 
                  alignSelf: log.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: log.sender === 'user' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                  color: log.sender === 'user' ? '#0b0f19' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  fontSize: '0.9rem',
                  fontWeight: log.sender === 'user' ? 500 : 400
                }}
              >
                {log.text}
              </div>
            ))}
            {loadingChat && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input 
              type="text" 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)}
              placeholder={t.placeholderChat}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }} 
            />
            <button 
              type="submit" 
              style={{ background: 'var(--primary-gradient)', border: 'none', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Send size={18} color="#0b0f19" />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
