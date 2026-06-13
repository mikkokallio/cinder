import { useAuth } from '../lib/AuthProvider';
import { api, Project } from '../lib/api';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import SessionDrawer from '../components/SessionDrawer';
import PortRegistry from '../components/PortRegistry';

export default function Home() {
  const { token, user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [portsOpen, setPortsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      api.projects.list(token).then(setProjects).catch(console.error);
    }
  }, [token]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-ember-500" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 2C10 2 6 8 6 16s4 14 10 14 10-6 10-14S22 2 16 2z"
              fill="currentColor"
              opacity="0.3"
            />
            <path
              d="M16 6c-3 0-6 3-6 9s1.5 10 6 13c4.5-3 6-7 6-13s-3-9-6-9z"
              fill="currentColor"
            />
          </svg>
          <h1 className="text-xl font-semibold">Cinder</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPortsOpen(true)}
            className="p-2 text-stone-400 hover:text-ember-400 transition-colors"
            title="Port Registry"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="18" rx="2" />
              <line x1="2" y1="9" x2="22" y2="9" />
              <line x1="2" y1="15" x2="22" y2="15" />
              <circle cx="6" cy="6" r="1" fill="currentColor" />
              <circle cx="6" cy="12" r="1" fill="currentColor" />
              <circle cx="6" cy="18" r="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => setSessionsOpen(true)}
            className="p-2 text-stone-400 hover:text-ember-400 transition-colors"
            title="Active Sessions"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          <span className="text-sm text-stone-400 hidden sm:inline">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-stone-400 hover:text-stone-200 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Project Grid */}
      <section>
        <h2 className="text-lg font-medium text-stone-300 mb-4">Projects</h2>
        {projects.length === 0 ? (
          <div className="glass-panel p-8 text-center text-stone-400">
            No projects registered yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Drawers / Modals */}
      <SessionDrawer
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        onSelectSession={(name) => navigate(`/project/${name}`)}
      />
      <PortRegistry open={portsOpen} onClose={() => setPortsOpen(false)} />
    </div>
  );
}
