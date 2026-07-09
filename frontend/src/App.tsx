import { useState, Component, ErrorInfo, ReactNode } from 'react';
import FanApp from './portals/FanApp';
import ControlRoom from './portals/ControlRoom';
import TournamentOps from './portals/TournamentOps';
import { Language, translations } from './i18n/translations';
import { ShieldCheck, User, LayoutDashboard, CalendarRange } from 'lucide-react';

// Error Boundary for UI resilience
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#0b0f19', minHeight: '100vh', color: '#fff' }}>
          <h2 style={{ color: 'var(--error-color)' }}>Something went wrong.</h2>
          <p>Please refresh the browser or check the local services.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [activePortal, setActivePortal] = useState<'fan' | 'control' | 'tournament'>('fan');

  const t = translations[lang];

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* PREMIUM STADIUM PLATFORM HEADER */}
        <header 
          style={{ 
            padding: '16px 40px', 
            borderBottom: '1px solid var(--border-color)', 
            background: 'rgba(11, 15, 25, 0.8)', 
            backdropFilter: 'blur(10px)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--primary-color)" />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SSTOps
            </h1>
            <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary-color)', fontWeight: 600 }}>
              Live Operations
            </span>
          </div>

          {/* TAB PORTAL SELECTOR */}
          <nav role="tablist" style={{ display: 'flex', gap: '8px' }}>
            <button 
              role="tab"
              aria-selected={activePortal === 'fan'}
              onClick={() => setActivePortal('fan')}
              style={{ 
                padding: '10px 16px', 
                borderRadius: '8px', 
                border: 'none', 
                background: activePortal === 'fan' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                color: activePortal === 'fan' ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <User size={16} />
              <span>{t.fanPortal}</span>
            </button>
            <button 
              role="tab"
              aria-selected={activePortal === 'control'}
              onClick={() => setActivePortal('control')}
              style={{ 
                padding: '10px 16px', 
                borderRadius: '8px', 
                border: 'none', 
                background: activePortal === 'control' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                color: activePortal === 'control' ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <LayoutDashboard size={16} />
              <span>{t.controlPortal}</span>
            </button>
            <button 
              role="tab"
              aria-selected={activePortal === 'tournament'}
              onClick={() => setActivePortal('tournament')}
              style={{ 
                padding: '10px 16px', 
                borderRadius: '8px', 
                border: 'none', 
                background: activePortal === 'tournament' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                color: activePortal === 'tournament' ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <CalendarRange size={16} />
              <span>{t.tournamentPortal}</span>
            </button>
          </nav>

          {/* LANGUAGE SELECTOR */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['en', 'hi', 'mr'] as const).map(l => (
              <button 
                key={l}
                onClick={() => setLang(l)}
                style={{ 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  border: lang === l ? '1px solid var(--primary-color)' : '1px solid var(--border-color)', 
                  background: lang === l ? 'rgba(0, 242, 254, 0.05)' : 'transparent',
                  color: lang === l ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </header>

        {/* PORTAL CORE VIEWPORTS */}
        <main style={{ flex: 1, padding: '24px 40px', maxWidth: '1280px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {activePortal === 'fan' && <FanApp lang={lang} />}
          {activePortal === 'control' && <ControlRoom lang={lang} />}
          {activePortal === 'tournament' && <TournamentOps lang={lang} />}
        </main>
        
        {/* FOOTER */}
        <footer style={{ borderTop: '1px solid var(--border-color)', padding: '20px 40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          SSTOps Stadium & Tournament Management. Built with Google Cloud Run, Vertex AI, Firestore & Memorystore.
        </footer>

      </div>
    </ErrorBoundary>
  );
}
