import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Terminal from '../components/Terminal';
import { useAuth } from '../lib/AuthProvider';
import { api } from '../lib/api';

type Tab = 'terminal' | 'editor' | 'preview';
type ShellType = 'bash' | 'copilot';

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('terminal');
  const [shellType, setShellType] = useState<ShellType>('bash');
  const [serverRunning, setServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (token && projectId) {
      fetch(`/api/projects/${projectId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setServerRunning(data.running);
          setServerPort(data.port);
        })
        .catch(() => {});
    }
  }, [token, projectId]);

  const handleStartServer = async () => {
    if (!token || !projectId) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setServerRunning(true);
      setServerPort(data.port);
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  };

  const handleStopServer = async () => {
    if (!token || !projectId) return;
    await fetch(`/api/projects/${projectId}/stop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setServerRunning(false);
    setServerPort(null);
  };

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
    },
    {
      id: 'editor',
      label: 'Editor',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      ),
    },
    {
      id: 'preview',
      label: 'Preview',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-coal-50">
        <button
          onClick={() => navigate('/')}
          className="text-stone-400 hover:text-stone-200 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-medium">{projectId}</h1>

        {/* Shell type toggle (visible on terminal tab) */}
        {activeTab === 'terminal' && (
          <div className="flex gap-1 bg-coal-200 rounded-md p-0.5 ml-2">
            <button
              onClick={() => setShellType('bash')}
              className={`px-2 py-1 text-xs rounded transition-all ${
                shellType === 'bash' ? 'bg-coal-50 text-ember-400' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              bash
            </button>
            <button
              onClick={() => setShellType('copilot')}
              className={`px-2 py-1 text-xs rounded transition-all ${
                shellType === 'copilot' ? 'bg-coal-50 text-ember-400' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              copilot
            </button>
          </div>
        )}

        {/* Dev server controls */}
        <div className="flex items-center gap-2 ml-auto mr-4">
          {serverRunning ? (
            <>
              <span className="text-xs text-emerald-400 font-mono">:{serverPort}</span>
              <span className="status-dot status-dot--running" />
              <button
                onClick={handleStopServer}
                className="text-xs px-2 py-1 text-red-400 hover:text-red-300 border border-red-400/30 rounded transition-colors"
              >
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={handleStartServer}
              disabled={starting}
              className="text-xs px-2 py-1 text-emerald-400 hover:text-emerald-300 border border-emerald-400/30 rounded transition-colors disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start Server'}
            </button>
          )}
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 bg-coal-200 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-coal-50 text-ember-500 shadow-ember-glow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && token && (
          <Terminal
            token={token}
            sessionName={`${projectId}-${shellType}`}
            shell={shellType}
            cwd={`/opt/cinder/projects/${projectId}`}
          />
        )}
        {activeTab === 'editor' && (
          <div className="flex items-center justify-center h-full text-stone-500">
            Editor (Monaco) -- coming in Phase 2
          </div>
        )}
        {activeTab === 'preview' && (
          <div className="h-full">
            {serverRunning && serverPort ? (
              <iframe
                src={`/app/${projectId}/`}
                className="w-full h-full border-0"
                title="App Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-stone-500">
                Start the dev server to preview the app
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden flex border-t border-coal-50 bg-coal-300">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              activeTab === tab.id ? 'text-ember-500' : 'text-stone-500'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
