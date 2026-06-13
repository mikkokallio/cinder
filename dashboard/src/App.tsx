import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthProvider';
import Home from './pages/Home';
import ProjectView from './pages/ProjectView';

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-ember-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <svg className="w-16 h-16 text-ember-500" viewBox="0 0 48 48" fill="none">
          <path d="M24 4C13 4 8 14 8 24s5 20 16 20 16-10 16-20S35 4 24 4z" fill="currentColor" opacity="0.2" />
          <path d="M24 8c-4 0-8 4-8 12s2 14 8 18c6-4 8-10 8-18s-4-12-8-12z" fill="currentColor" />
          <circle cx="24" cy="20" r="3" fill="#0a0a0a" />
        </svg>
        <h1 className="text-2xl font-semibold text-stone-100">Cinder</h1>
        <button
          onClick={login}
          className="px-6 py-3 bg-ember-500 hover:bg-ember-600 text-white font-medium rounded-lg transition-all hover:shadow-ember-glow-strong"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/project/:projectId" element={<ProjectView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoutes />
    </AuthProvider>
  );
}
