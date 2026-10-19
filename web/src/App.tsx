import { BarChart3, Compass, GitBranch, Network, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tabs, type TabDef } from './components/Tabs';
import { StatusPill, StatusProvider } from './components/status';
import { Badge } from './components/ui';
import { ArchitecturePage } from './pages/Architecture';
import { DashboardPage } from './pages/Dashboard';
import { PipelinePage } from './pages/Pipeline';
import { SqlExplorerPage } from './pages/SqlExplorer';
import { StartHerePage } from './pages/StartHere';

const TABS: TabDef[] = [
  { id: 'start', label: 'Start here', icon: <Compass size={16} /> },
  { id: 'architecture', label: 'Architecture', icon: <Network size={16} /> },
  { id: 'pipeline', label: 'Pipeline', icon: <GitBranch size={16} /> },
  { id: 'sql', label: 'SQL Explorer', icon: <Terminal size={16} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
];

const readHash = () => {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'start';
};

export default function App() {
  // Shareable document view (used for the PDF / HTML export): architecture only, no app chrome.
  if (window.location.hash === '#doc') return <main className="doc"><ArchitecturePage doc /></main>;
  return <DemoApp />;
}

function DemoApp() {
  const [tab, setTab] = useState(readHash);
  useEffect(() => {
    const on = () => { setTab(readHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (id: string) => { window.location.hash = id; };

  return (
    <StatusProvider>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-row">
            <span className="brand">Trusted Data Foundation — local demo</span>
            <Badge tone="warn">Synthetic data</Badge>
            <Badge>Not production</Badge>
            <span className="spacer" />
            <StatusPill />
          </div>
          <Tabs tabs={TABS} active={tab} onChange={go} />
        </div>
      </header>
      <main className="page">
        {tab === 'start' && <StartHerePage go={go} />}
        {tab === 'architecture' && <ArchitecturePage />}
        {/* Pipeline stays mounted so a running log survives tab switches. */}
        <div hidden={tab !== 'pipeline'}><PipelinePage go={go} /></div>
        {tab === 'sql' && <SqlExplorerPage go={go} />}
        {tab === 'dashboard' && <DashboardPage go={go} />}
      </main>
    </StatusProvider>
  );
}
