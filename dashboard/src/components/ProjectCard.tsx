import { Project, api } from '../lib/api';
import { useAuth } from '../lib/AuthProvider';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [showInput, setShowInput] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !token) return;
    setSending(true);
    try {
      const res = await api.sessions.auto(token, {
        prompt: prompt.trim(),
        path: project.path,
        session_name: `auto-${project.id}-${Date.now()}`,
      });
      setPrompt('');
      setShowInput(false);
      // Navigate to project terminal where user can watch
      navigate(`/project/${project.id}?session=${res.session_name}`);
    } catch (err) {
      console.error('Auto session failed:', err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass-panel p-5 hover:shadow-ember-glow transition-all duration-200 group relative">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-coal-300 flex items-center justify-center group-hover:bg-coal-50 transition-colors">
            <ProjectIcon name={project.icon} />
          </div>
          <div className="flex items-center gap-2">
            {project.running && (
              <span className="text-xs text-emerald-400 font-medium">:{project.port}</span>
            )}
            <span className={`status-dot ${project.running ? 'status-dot--running' : 'status-dot--idle'}`} />
          </div>
        </div>
        <h3 className="font-medium text-stone-100 mb-1">{project.name}</h3>
        <p className="text-sm text-stone-500 truncate">{project.dev_command}</p>
      </button>

      {/* Quick-change shortcut */}
      <div className="mt-3 border-t border-coal-50 pt-3">
        {!showInput ? (
          <button
            onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-ember-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Quick change...
          </button>
        ) : (
          <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1.5">
              <input
                autoFocus
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowInput(false); setPrompt(''); } }}
                placeholder="Describe the change..."
                disabled={sending}
                className="flex-1 bg-coal-300 border border-coal-50 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-ember-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !prompt.trim()}
                className="px-2 py-1 text-xs bg-ember-500/20 text-ember-400 border border-ember-500/30 rounded hover:bg-ember-500/30 transition-colors disabled:opacity-40"
              >
                {sending ? '...' : 'Go'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ProjectIcon({ name }: { name: string }) {
  switch (name) {
    case 'globe':
      return (
        <svg className="w-5 h-5 text-ember-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      );
    case 'terminal':
      return (
        <svg className="w-5 h-5 text-ember-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-ember-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      );
  }
}
