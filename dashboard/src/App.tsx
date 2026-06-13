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
      <div className="relative flex flex-col items-center justify-center min-h-screen gap-8 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-coal-500 via-coal-300 to-coal-500" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,107,53,0.08)_0%,_transparent_70%)]" />

        {/* Floating ember particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 rounded-full bg-ember-500/40 animate-glow-pulse" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full bg-ember-400/30 animate-glow-pulse" style={{ animationDelay: '0.7s' }} />
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 rounded-full bg-ember-600/40 animate-glow-pulse" style={{ animationDelay: '1.4s' }} />
          <div className="absolute top-2/3 right-1/4 w-0.5 h-0.5 rounded-full bg-ember-300/20 animate-glow-pulse" style={{ animationDelay: '0.3s' }} />
        </div>

        {/* Login card */}
        <div className="relative z-10 flex flex-col items-center gap-8 p-10 glass-panel ember-border max-w-sm w-full mx-4">
          {/* Cinder flame icon */}
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-ember-500/20 rounded-full scale-150" />
            <svg className="relative w-16 h-16 text-ember-500 drop-shadow-[0_0_12px_rgba(255,107,53,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2c0 4-3 6-3 10a5 5 0 0 0 10 0c0-4-4-6-4-8 0 0-1 2-3 2s-2-2 0-4z" fill="currentColor" opacity="0.3" stroke="none" />
              <path d="M12 2c0 4-3 6-3 10a5 5 0 0 0 10 0c0-4-4-6-4-8 0 0-1 2-3 2s-2-2 0-4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-stone-50 tracking-tight">Cinder</h1>
            <p className="mt-2 text-sm text-stone-400">Persistent development server</p>
          </div>

          <button
            onClick={login}
            className="w-full px-6 py-3.5 bg-gradient-to-r from-ember-600 to-ember-500 hover:from-ember-500 hover:to-ember-400 text-white font-medium rounded-lg transition-all duration-200 shadow-ember-glow hover:shadow-ember-glow-strong active:scale-[0.98]"
          >
            Sign in with Microsoft
          </button>

          <p className="text-xs text-stone-500">Secured with Microsoft Entra ID</p>
        </div>
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
