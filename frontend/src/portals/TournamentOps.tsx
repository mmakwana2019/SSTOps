import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { translations, Language } from '../i18n/translations';
import { Calendar, CheckCircle2, AlertTriangle, FileBarChart, DollarSign, Users } from 'lucide-react';

interface TournamentOpsProps {
  lang: Language;
}

export default function TournamentOps({ lang }: TournamentOpsProps) {
  const t = translations[lang];
  const [fixtures, setFixtures] = useState<any[]>([
    { team1: 'Mumbai Challengers', team2: 'Delhi Knights', date: '2026-07-09', time: '19:30', venue: 'Wankhede Stadium', officials: ['A. Rauf', 'K. Dharmasena'], broadcastSlot: 'StarSports 1 HD / Hotstar VIP 1' }
  ]);
  const [team1, setTeam1] = useState('Chennai Titans');
  const [team2, setTeam2] = useState('Kolkata Kings');
  const [date, setDate] = useState('2026-07-09');
  const [time, setTime] = useState('19:30');
  const [venue, setVenue] = useState('Wankhede Stadium');
  const [officialsInput, setOfficialsInput] = useState('A. Rauf, J. Srinath');
  const [broadcastSlot, setBroadcastSlot] = useState('StarSports 1 HD / Hotstar VIP 1');

  const [conflicts, setConflicts] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [reconciliation, setReconciliation] = useState<any>({
    ticketsSold: 32500,
    attendance: 1250, // Starts low, will increase if ticket scans happen
    revenue: 48750000,
    rate: 3.8
  });
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);

  // Sync tickets & scan counts for BQ reconciliation simulation
  const syncReconciliationData = () => {
    axios.get('/api/forecasting/surge')
      .then(res => {
        // Calculate cumulative count of scanned tickets
        const predictions = res.data.predictions;
        const totalScanned = predictions.reduce((sum: number, p: any) => sum + p.currentVelocity * 10, 28500);
        
        setReconciliation({
          ticketsSold: 32500,
          attendance: Math.min(totalScanned, 32500),
          revenue: 48750000,
          rate: ((Math.min(totalScanned, 32500) / 32500) * 100).toFixed(1)
        });
      }).catch(err => console.warn('Using fallback reconciliation data:', err.message));
  };

  useEffect(() => {
    syncReconciliationData();
    const interval = setInterval(syncReconciliationData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflicts([]);
    setSuccessMsg('');

    const officialsList = officialsInput.split(',').map(o => o.trim());

    try {
      const response = await axios.post('/api/fixtures/create', {
        team1,
        team2,
        date,
        time,
        venue,
        officials: officialsList,
        broadcastSlot
      });

      if (response.status === 201) {
        setSuccessMsg(response.data.message);
        setFixtures(prev => [...prev, response.data.fixture]);
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        setConflicts(err.response.data.conflicts || [err.response.data.error]);
      } else {
        setConflicts(['Failed to connect to conflict detection service.']);
      }
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setReportMarkdown('');
    try {
      const response = await axios.post('/api/gemini/report', {
        matchId: 'match_final_ipl_2026'
      });
      setReportMarkdown(response.data.report);
    } catch (err) {
      setReportMarkdown('Error creating report. Ensure API backend is reachable.');
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '12px 0' }}>
      
      {/* LEFT COLUMN: Conflict Scheduler */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* FIXTURE SCHEDULER FORM */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} />
            <span>{t.conflictBuilder}</span>
          </h3>

          <form onSubmit={handleCreateFixture} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Team 1</label>
                <input 
                  type="text" 
                  value={team1} 
                  onChange={e => setTeam1(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Team 2</label>
                <input 
                  type="text" 
                  value={team2} 
                  onChange={e => setTeam2(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Match Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Time Slot</label>
                <input 
                  type="time" 
                  value={time} 
                  onChange={e => setTime(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Venue Selection</label>
              <select 
                value={venue} 
                onChange={e => setVenue(e.target.value)}
                style={{ width: '100%', padding: '8px', background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }}
              >
                <option value="Wankhede Stadium">Wankhede Stadium (Mumbai)</option>
                <option value="Narendra Modi Stadium">Narendra Modi Stadium (Ahmedabad)</option>
                <option value="M. Chinnaswamy Stadium">M. Chinnaswamy Stadium (Bengaluru)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Match Officials (Comma separated)</label>
              <input 
                type="text" 
                value={officialsInput} 
                onChange={e => setOfficialsInput(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Broadcast Slot</label>
              <input 
                type="text" 
                value={broadcastSlot} 
                onChange={e => setBroadcastSlot(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff' }} 
              />
            </div>

            <button 
              type="submit" 
              style={{ background: 'var(--primary-gradient)', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 600, color: '#0b0f19', cursor: 'pointer', marginTop: '6px' }}
            >
              {t.saveFixture}
            </button>
          </form>

          {/* Conflict Warnings Board */}
          {conflicts.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(255, 0, 85, 0.05)', border: '1px solid rgba(255, 0, 85, 0.2)' }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                <AlertTriangle size={16} />
                <span>Conflict Warnings Detected!</span>
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {conflicts.map((conf, index) => (
                  <li key={index} style={{ marginBottom: '4px' }}>{conf}</li>
                ))}
              </ul>
            </div>
          )}

          {successMsg && (
            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* LIST OF FIXTURES */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>Scheduled Fixtures</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
            {fixtures.map((f, i) => (
              <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '0.9rem' }}>{f.team1} vs {f.team2}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  📅 {f.date} | ⏰ {f.time} | 📍 {f.venue}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  📺 TV: {f.broadcastSlot}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: BQ Reconciliation & Gemini Reports */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* RECONCILIATION DATA */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{t.reconciliationTitle}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <Users size={16} />
                <span>Attendance Ratio</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'var(--primary-color)' }}>{reconciliation.rate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{reconciliation.attendance} / {reconciliation.ticketsSold} Scanned</div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <DollarSign size={16} />
                <span>{t.totalRevenue}</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--success-color)' }}>₹4.87 Cr</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>INR (Ticket sales direct)</div>
            </div>
          </div>

          <div style={{ background: '#0e1422', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <b style={{ color: '#fff' }}>BigQuery Pipeline Status:</b> Stream ingestion active. Partitioned tables (`attendance_logs`) running aggregation jobs every 60 seconds.
          </div>
        </div>

        {/* GEMINI COMPILER */}
        <div className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)' }}>Post-Match Reporting</h3>
          
          <button 
            onClick={handleGenerateReport}
            disabled={loadingReport}
            style={{ background: 'var(--accent-gradient)', border: 'none', borderRadius: '8px', padding: '12px', fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <FileBarChart size={18} />
            <span>{loadingReport ? 'Generating Report...' : t.postMatchReport}</span>
          </button>

          {reportMarkdown && (
            <div className="glass-panel" style={{ padding: '16px', background: '#0e1422', maxHeight: '240px', overflowY: 'auto', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
              {reportMarkdown}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
