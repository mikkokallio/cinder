const API_BASE = '/api';

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export interface Project {
  id: string;
  name: string;
  path: string;
  repo: string | null;
  dev_command: string;
  preferred_port: number | null;
  icon: string;
  running: boolean;
  port: number | null;
}

export interface PortEntry {
  project_id: string;
  port: number;
  pid: number | null;
  started_at: string | null;
}

export interface TerminalSession {
  name: string;
  shell: string;
  created_at: number;
  last_activity: number;
  attached: boolean;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'dir';
  size: number | null;
}

export const api = {
  projects: {
    list: (token: string) => apiFetch('/projects', token) as Promise<Project[]>,
    create: (token: string, data: Partial<Project>) =>
      apiFetch('/projects', token, { method: 'POST', body: JSON.stringify(data) }),
    delete: (token: string, id: string) =>
      apiFetch(`/projects/${id}`, token, { method: 'DELETE' }),
  },
  files: {
    list: (token: string, projectId: string, path = '.') =>
      apiFetch(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`, token) as Promise<{ path: string; entries: FileEntry[] }>,
    read: (token: string, projectId: string, path: string) =>
      apiFetch(`/projects/${projectId}/file?path=${encodeURIComponent(path)}`, token) as Promise<{ path: string; content: string }>,
    write: (token: string, projectId: string, path: string, content: string) =>
      apiFetch(`/projects/${projectId}/file?path=${encodeURIComponent(path)}`, token, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
  },
  ports: {
    list: (token: string) => apiFetch('/ports', token) as Promise<PortEntry[]>,
    allocate: (token: string, projectId: string, preferred?: number) =>
      apiFetch(`/ports/allocate?project_id=${projectId}${preferred ? `&preferred=${preferred}` : ''}`, token, { method: 'POST' }),
    release: (token: string, port: number) =>
      apiFetch(`/ports/${port}`, token, { method: 'DELETE' }),
  },
  sessions: {
    list: (token: string) =>
      fetch('/api/sessions', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : []) as Promise<TerminalSession[]>,
    terminate: (token: string, name: string) =>
      fetch(`/api/sessions/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    auto: (token: string, data: { prompt: string; path: string; session_name?: string }) =>
      fetch('/api/sessions/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(r => r.json()) as Promise<{ session_name: string; status: string }>,
  },
};
