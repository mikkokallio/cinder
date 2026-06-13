import { useAuth } from '../lib/AuthProvider';
import { api, TerminalSession } from '../lib/api';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectSession: (name: string) => void;
}

export default function SessionDrawer({ open, onClose, onSelectSession }: Props) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<TerminalSession[]>([]);

  useEffect(() => {
    if (open && token) {
      api.sessions.list(token).then(setSessions).catch(() => setSessions([]));
    }
  }, [open, token]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-coal-200 border-l border-ember-500/20 z-50 flex flex-col shadow-2xl">
        <header className="flex items-center justify-between px-4 py-4 border-b border-coal-50">
          <h2 className="text-lg font-medium">Active Sessions</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-stone-500 text-sm text-center mt-8">No active sessions</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.name}
                onClick={() => {
                  onSelectSession(session.name);
                  onClose();
                }}
                className="w-full glass-panel p-3 text-left hover:shadow-ember-glow transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{session.name}</span>
                  <span className={`status-dot ${session.attached ? 'status-dot--running' : 'status-dot--idle'}`} />
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span>{session.shell === '/bin/bash' ? 'bash' : 'copilot'}</span>
                  <span>-</span>
                  <span>{formatTimeAgo(session.last_activity)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
