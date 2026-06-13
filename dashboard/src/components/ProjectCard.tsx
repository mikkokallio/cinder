import { Project } from '../lib/api';

interface Props {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="glass-panel p-5 text-left hover:shadow-ember-glow transition-all duration-200 group"
    >
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
