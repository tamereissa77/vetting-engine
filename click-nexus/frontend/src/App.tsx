import React, { useState, useEffect } from 'react';
import { NexusPortal } from './components/NexusPortal';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const roleParam = params.get('role');

    if (tokenParam && roleParam) {
      localStorage.setItem('token', tokenParam);
      localStorage.setItem('role', roleParam);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      url.searchParams.delete('role');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || !role) {
      window.location.href = `http://${window.location.hostname}:5175/`;
      return;
    }

    const allowedRoles = ['admin', 'applicant'];
    if (!allowedRoles.includes(role)) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = `http://${window.location.hostname}:5175/?error=unauthorized`;
      return;
    }

    setIsAuthenticated(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = `http://${window.location.hostname}:5175/`;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0f14] flex flex-col items-center justify-center font-mono text-xs text-slate-500 gap-3">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="tracking-widest uppercase text-cyan-400">Verifying ATS session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f14] text-slate-100 font-sans antialiased relative">
      <NexusPortal onLogout={handleLogout} />
    </div>
  );
}
