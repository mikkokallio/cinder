import { api, PortEntry } from '../lib/api';
import { useAuth } from '../lib/AuthProvider';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PortRegistry({ open, onClose }: Props) {
  const { token } = useAuth();
  const [ports, setPorts] = useState<PortEntry[]>([]);

  useEffect(() => {
    if (open && token) {
      api.ports.list(token).then(setPorts).catch(() => setPorts([]));
    }
  }, [open, token]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10vh] max-w-lg mx-auto bg-coal-200 border border-ember-500/20 rounded-xl z-50 shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-coal-50">
          <h2 className="text-lg font-medium">Port Registry</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {ports.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-4">No ports allocated</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-400 border-b border-coal-50">
                  <th className="text-left pb-2 font-medium">Port</th>
                  <th className="text-left pb-2 font-medium">Project</th>
                  <th className="text-left pb-2 font-medium">PID</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((entry) => (
                  <tr key={entry.port} className="border-b border-coal-50/50">
                    <td className="py-2 font-mono text-ember-400">{entry.port}</td>
                    <td className="py-2">{entry.project_id}</td>
                    <td className="py-2 text-stone-500">{entry.pid || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
