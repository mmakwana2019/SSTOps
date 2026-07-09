import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { translations, Language } from '../i18n/translations';
import { AlertTriangle, Plus, FileText, ShieldAlert, HeartPulse, HardHat, Eye } from 'lucide-react';

interface ControlRoomProps {
  lang: Language;
}

export default function ControlRoom({ lang }: ControlRoomProps) {
  const t = translations[lang];
  const [role, setRole] = useState<'command' | 'security' | 'medical' | 'facilities'>('command');
  const [gates, setGates] = useState<any[]>([
    { name: 'GateA', rate: 25, status: 'clear', count: 45 },
    { name: 'GateB', rate: 110, status: 'congested', count: 180 },
    { name: 'GateC', rate: 45, status: 'clear', count: 70 },
    { name: 'GateD', rate: 160, status: 'critical', count: 320 }
  ]);
  const [incidents, setIncidents] = useState<any[]>([
    { id: '1', title: 'Power fluctuation at North Concourse', location: 'Sector A', severity: 'medium', status: 'resolved', timestamp: '11:20 AM', desc: 'Main transformer load balance adjusted.' }
  ]);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('Gate B');
  const [newSeverity, setNewSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newDesc, setNewDesc] = useState('');
  const [handoverSummary, setHandoverSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Fetch live stats & forecasting
  const fetchTelemetry = () => {
    axios.get('/api/forecasting/surge')
      .then(res => {
        const predictions = res.data.predictions;
        const mapped = predictions.map((p: any) => ({
          name: p.gate,
          rate: p.currentVelocity,
          status: p.trend,
          count: p.currentVelocity * 2 // Aggregate count estimate
        }));
        setGates(mapped);
      }).catch(err => console.warn('Using fallback telemetry:', err.message));
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const loggedItem = {
      id: String(incidents.length + 1),
      title: newTitle,
      location: newLocation,
      severity: newSeverity,
      status: 'open',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      desc: newDesc
    };

    // Update locally
    setIncidents(prev => [loggedItem, ...prev]);
    
    // Simulating vision system edge updates in Firestore if zone incident reported
    if (newTitle.toLowerCase().includes('crowd') || newTitle.toLowerCase().includes('queue')) {
      axios.post('/api/vision/crowd', {
        zoneId: newLocation.replace(' ', ''),
        count: newSeverity === 'critical' ? 350 : newSeverity === 'high' ? 220 : 120
      }).then(() => fetchTelemetry())
        .catch(err => console.error(err));
    }

    setNewTitle('');
    setNewDesc('');
  };

  const generateHandover = async () => {
    setLoadingSummary(true);
    try {
      // First seed firestore with current list
      const response = await axios.post('/api/gemini/summarize', {
        shiftId: 'morning_shift_0708'
      });
      setHandoverSummary(response.data.summary);
    } catch (err) {
      setHandoverSummary('Error compilation: please ensure the local Express server is running on port 8080.');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', padding: '12px 0' }}>
      
      {/* LEFT PORTION: Heatmap & Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ROLE BAR CONTROLLER */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={20} color="var(--primary-color)" />
            <h4 style={{ margin: 0, fontSize: '1rem' }}>{t.roleView}</h4>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['command', 'security', 'medical', 'facilities'] as const).map(r => (
              <button 
                key={r}
                onClick={() => setRole(r)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)', 
                  background: role === r ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.02)',
                  color: role === r ? '#0b0f19' : 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {r === 'security' && <ShieldAlert size={14} />}
                {r === 'medical' && <HeartPulse size={14} />}
                {r === 'facilities' && <HardHat size={14} />}
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* STADIUM CROWD HEATMAP */}
        {(role === 'command' || role === 'security' || role === 'facilities') && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.concourseHeatmap}</h3>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              
              {/* Heatmap Overlay Vector */}
              <div style={{ background: '#0e1422', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '10px' }}>
                <svg width="220" height="220" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#1f293d" strokeWidth="4" />
                  
                  {/* Gate Nodes with Heat Indicator rings */}
                  {gates.map((g, idx) => {
                    let cx = 100, cy = 100;
                    if (g.name === 'GateA') { cx = 100; cy = 15; }
                    if (g.name === 'GateB') { cx = 185; cy = 100; }
                    if (g.name === 'GateC') { cx = 100; cy = 185; }
                    if (g.name === 'GateD') { cx = 15; cy = 100; }

                    const heatColor = g.status === 'critical' ? 'rgba(255, 0, 85, 0.4)' : g.status === 'congested' ? 'rgba(255, 159, 28, 0.3)' : 'rgba(0, 245, 212, 0.2)';
                    const coreColor = g.status === 'critical' ? '#ff0055' : g.status === 'congested' ? '#ff9f1c' : '#00f5d4';

                    return (
                      <g key={idx}>
                        {/* Heat glow */}
                        <circle cx={cx} cy={cy} r="18" fill={heatColor} className={g.status === 'critical' ? 'pulse-alert' : ''} />
                        <circle cx={cx} cy={cy} r="6" fill={coreColor} />
                        <text x={cx} y={cy - 10} fill="#fff" fontSize="8" textAnchor="middle">{g.name}</text>
                      </g>
                    );
                  })}

                  {/* Pitch representation */}
                  <rect x="70" y="70" width="60" height="60" rx="4" fill="none" stroke="#2a364f" strokeWidth="1" />
                </svg>
              </div>

              {/* Legend & Vision Compliance Callout */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0, 242, 254, 0.04)', border: '1px solid rgba(0, 242, 254, 0.1)', fontSize: '0.85rem' }}>
                  <b style={{ color: 'var(--primary-color)' }}>Vertex AI Vision Core:</b>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Edge processing computes camera count telemetry safely. Zero facial recognition or biometrics logged.</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {gates.map((g, i) => (
                    <div key={i} className="glass-panel" style={{ flex: '1 1 40%', padding: '8px', fontSize: '0.8rem' }}>
                      <b>{g.name}:</b> {g.count} present
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ALERTS PANEL */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} />
            <span>{t.alertsPanel}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gates.filter(g => g.status === 'critical' || g.status === 'congested').map((g, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 159, 28, 0.05)', border: '1px solid rgba(255, 159, 28, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--warning-color)' }}>⚠️ Surge Predicted at {g.name}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Forecast: +15 mins</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Entry velocity is {g.rate} scans/min (Capacity ratio: {(g.rate / 5).toFixed(1)}%). Recommending dispatch of 2 field staff to Gate D.
                </div>
              </div>
            ))}
            {gates.filter(g => g.status === 'critical' || g.status === 'congested').length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '12px' }}>
                No active crowd pressure warnings. All gates flow within normal parameters.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT PORTION: Incident Logs & Handover */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* LOG NEW INCIDENT */}
        {(role === 'command' || role === 'security' || role === 'medical') && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.logIncident}</h3>
            
            <form onSubmit={handleLogIncident} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t.incidentDescription}</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  required
                  placeholder="e.g. Scuffle at Food Stall Zone C"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t.incidentLocation}</label>
                  <select 
                    value={newLocation} 
                    onChange={e => setNewLocation(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="Gate A">Gate A</option>
                    <option value="Gate B">Gate B</option>
                    <option value="Sector A">Sector A</option>
                    <option value="Sector B">Sector B</option>
                    <option value="Food Court">Food Court</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{t.severity}</label>
                  <select 
                    value={newSeverity} 
                    onChange={e => setNewSeverity(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Incident Details</label>
                <textarea 
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2} 
                  placeholder="Additional context/actions taken..."
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <button 
                type="submit" 
                style={{ background: 'var(--primary-gradient)', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 600, color: '#0b0f19', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={16} />
                <span>{t.logBtn}</span>
              </button>
            </form>
          </div>
        )}

        {/* RECENT INCIDENT FEED & HANDOVER SUMMARY */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>Incident Feed</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
              {incidents.map((inc, i) => {
                const color = inc.severity === 'critical' || inc.severity === 'high' ? 'var(--error-color)' : inc.severity === 'medium' ? 'var(--warning-color)' : 'var(--success-color)';
                return (
                  <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600 }}>{inc.title}</span>
                      <span style={{ color }}>{inc.severity.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loc: {inc.location} | Time: {inc.timestamp}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>{inc.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={generateHandover} 
              disabled={loadingSummary}
              style={{ background: 'var(--accent-gradient)', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <FileText size={16} />
              <span>{loadingSummary ? 'Compiling summary...' : t.geminiSummaryBtn}</span>
            </button>

            {handoverSummary && (
              <div className="glass-panel" style={{ padding: '12px', background: '#0e1422', maxHeight: '180px', overflowY: 'auto', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                {handoverSummary}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
