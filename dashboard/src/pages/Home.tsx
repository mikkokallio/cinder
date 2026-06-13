import { useAuth } from '../lib/AuthProvider';
import { api, Project } from '../lib/api';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import SessionDrawer from '../components/SessionDrawer';
import PortRegistry from '../components/PortRegistry';
import NewProjectDialog from '../components/NewProjectDialog';

export default function Home() {
  const { token, user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [portsOpen, setPortsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      api.projects.list(token).then(setProjects).catch(console.error);
    }
  }, [token]);

  return (
    <div className="relative min-h-screen p-4 md:p-8">
      {/* Background gradient (same as login) */}
      <div className="fixed inset-0 bg-gradient-to-br from-coal-500 via-coal-300 to-coal-500 -z-10" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,107,53,0.06)_0%,_transparent_60%)] -z-10" />

      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-ember-500 drop-shadow-[0_0_6px_rgba(255,107,53,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M12 2.5c-1.8 3.4-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-3.2-6.1-5-9.5z" fill="currentColor" opacity="0.25" stroke="none" />
            <path d="M12 2.5c-1.8 3.4-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-3.2-6.1-5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8c-1 1.8-2.2 3-2.2 4.8a2.2 2.2 0 0 0 4.4 0c0-1.8-1.2-3-2.2-4.8z" fill="currentColor" opacity="0.5" stroke="none" />
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-stone-300">Projects</h2>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ember-400 border border-ember-500/30 rounded-lg hover:bg-ember-500/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="glass-panel p-8 text-center text-stone-400">
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/project/${project.id}`)}
                onUpdate={() => { if (token) api.projects.list(token).then(setProjects); }}
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
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={() => {
          if (token) api.projects.list(token).then(setProjects);
        }}
      />
    </div>
  );
}
