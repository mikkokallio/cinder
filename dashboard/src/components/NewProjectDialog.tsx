import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [devCommand, setDevCommand] = useState('npm run dev');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id.trim() || !name.trim()) return;

    setCreating(true);
    setError('');
    try {
      await api.projects.create(token, {
        id: id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name: name.trim(),
        repo: repo.trim() || null,
        dev_command: devCommand.trim() || 'npm run dev',
      });
      setId('');
      setName('');
      setRepo('');
      setDevCommand('npm run dev');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    }
    setCreating(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10vh] max-w-md mx-auto glass-panel ember-border z-50 shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-coal-50">
          <h2 className="text-lg font-medium">New Project</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-stone-400 mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!id || id === name.toLowerCase().replace(/[^a-z0-9-]/g, '-')) {
                  setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                }
              }}
              placeholder="My App"
              className="w-full px-3 py-2 bg-coal-300 border border-coal-50 rounded-lg text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-ember-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Slug</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="my-app"
              className="w-full px-3 py-2 bg-coal-300 border border-coal-50 rounded-lg text-stone-100 font-mono text-sm placeholder:text-stone-600 focus:outline-none focus:border-ember-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Git repo (optional)</label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="w-full px-3 py-2 bg-coal-300 border border-coal-50 rounded-lg text-stone-100 text-sm placeholder:text-stone-600 focus:outline-none focus:border-ember-500/50"
            />
            <p className="text-xs text-stone-500 mt-1">Leave empty to start from scratch</p>
          </div>

          <div>
            <label className="block text-sm text-stone-400 mb-1">Dev command</label>
            <input
              type="text"
              value={devCommand}
              onChange={(e) => setDevCommand(e.target.value)}
              className="w-full px-3 py-2 bg-coal-300 border border-coal-50 rounded-lg text-stone-100 font-mono text-sm placeholder:text-stone-600 focus:outline-none focus:border-ember-500/50"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-coal-50 text-stone-300 rounded-lg hover:bg-coal-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !id || !name}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-ember-600 to-ember-500 hover:from-ember-500 hover:to-ember-400 text-white font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
