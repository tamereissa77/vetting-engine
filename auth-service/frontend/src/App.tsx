import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User as UserIcon, CheckCircle2, AlertCircle, ArrowRight, Compass, LogOut } from 'lucide-react';

const getApiUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8002`;
};

export default function App() {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<string>('applicant');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // For Admin role: choice portal state
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);

  // Check if we already have an active admin session or redirect params
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedRole = localStorage.getItem('auth_role');
    const savedName = localStorage.getItem('auth_name');

    if (savedToken && savedRole === 'admin') {
      setAdminToken(savedToken);
      setAdminName(savedName || 'Administrator');
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccess('Account created successfully! Switching to sign in...');
      setTimeout(() => {
        setIsLogin(true);
        setPassword('');
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Sign in failed');
      }

      const { access_token, role: userRole, name } = data;
      setSuccess('Authentication successful! Forwarding...');

      // Redirect workflow based on role
      setTimeout(() => {
        const hostname = window.location.hostname;
        if (userRole === 'admin') {
          // Store token in localstorage for choice portal
          localStorage.setItem('auth_token', access_token);
          localStorage.setItem('auth_role', userRole);
          localStorage.setItem('auth_name', name);
          setAdminToken(access_token);
          setAdminName(name);
          setIsLoading(false);
        } else if (userRole === 'applicant') {
          window.location.href = `http://${hostname}:5174/?token=${access_token}&role=${userRole}`;
        } else if (userRole === 'HR' || userRole === 'project_manager') {
          window.location.href = `http://${hostname}:5173/?token=${access_token}&role=${userRole}`;
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Connection error');
      setIsLoading(false);
    }
  };

  const handleLogoutAdmin = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_name');
    setAdminToken(null);
    setAdminName(null);
  };

  // If logged in as Admin, show portal choice screen
  if (adminToken) {
    const hostname = window.location.hostname;
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center p-4">
        {/* Decorative Grid and Ambient Lights */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="cyber-panel cyber-panel-glow-purple max-w-4xl w-full rounded-2xl p-8 md:p-12 relative z-10">
          <div className="flex justify-between items-center border-b border-slate-800 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Sovereign Platform Hub
              </h1>
              <p className="text-slate-400 text-sm mt-1">Logged in as {adminName} (Admin)</p>
            </div>
            <button
              onClick={handleLogoutAdmin}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-700 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg text-sm transition-all"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Click Vitting Card */}
            <a
              href={`http://${hostname}:5173/?token=${adminToken}&role=admin`}
              className="group flex flex-col justify-between p-6 border border-slate-800 hover:border-purple-500/40 bg-slate-900/40 hover:bg-slate-900/60 rounded-xl transition-all duration-300"
            >
              <div>
                <div className="w-12 h-12 flex items-center justify-center bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400 mb-4 group-hover:bg-purple-500/20 group-hover:scale-105 transition-all">
                  <Shield size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-100 group-hover:text-purple-400 transition-colors">
                  Vitting Vetting Engine
                </h2>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Analyze Statement of Work documents, manage custom profiles/capabilities, and assign vetted resources. Restricted to Admin, HR, and Project Managers.
                </p>
              </div>
              <div className="flex items-center gap-2 text-purple-400 font-medium text-sm mt-6">
                <span>Enter Vetting Engine</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </a>

            {/* Click Nexus Card */}
            <a
              href={`http://${hostname}:5174/?token=${adminToken}&role=admin`}
              className="group flex flex-col justify-between p-6 border border-slate-800 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/60 rounded-xl transition-all duration-300"
            >
              <div>
                <div className="w-12 h-12 flex items-center justify-center bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400 mb-4 group-hover:bg-cyan-500/20 group-hover:scale-105 transition-all">
                  <Compass size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                  Click Nexus Gateway
                </h2>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  ATS job board where candidates submit their CVs or LinkedIn URLs for automated matching and instant scorecards. Restricted to Admin and Applicants.
                </p>
              </div>
              <div className="flex items-center gap-2 text-cyan-400 font-medium text-sm mt-6">
                <span>Enter Nexus ATS</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 relative">
      {/* Glow Effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-purple-600/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-cyan-600/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Login / Registration Panel */}
      <div className="cyber-panel cyber-panel-glow-purple max-w-md w-full rounded-2xl overflow-hidden relative z-10">
        <div className="p-8">
          {/* Logo and Titles */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-purple-glow mb-3">
              <Shield className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              CLICK GROUP TALENT ENGINE
            </h1>
            <p className="text-slate-400 text-xs mt-1">Access Control Portal</p>
          </div>

          {/* Form Tabs */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 pb-3 text-center text-sm font-medium transition-colors border-b-2 ${
                isLogin ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 pb-3 text-center text-sm font-medium transition-colors border-b-2 ${
                !isLogin ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error and Success Banners */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 text-sm mb-5">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-green-500/20 bg-green-950/20 text-green-400 text-sm mb-5">
              <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Auth Forms */}
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-purple-500 rounded-lg text-slate-200 placeholder-slate-600 text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-purple-500 rounded-lg text-slate-200 placeholder-slate-600 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-purple-500 rounded-lg text-slate-200 placeholder-slate-600 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Select Platform Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-purple-500 rounded-lg text-slate-200 text-sm focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='24' height='24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`, backgroundPosition: 'right 12px center', backgroundSize: '16px', backgroundRepeat: 'no-repeat' }}
                >
                  <option value="applicant">Applicant (Click Nexus ATS)</option>
                  <option value="HR">HR Specialist (Vitting Engine)</option>
                  <option value="project_manager">Project Manager (Vitting Engine)</option>
                  <option value="admin">Administrator (All Systems)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-medium rounded-lg text-sm shadow-purple-glow hover:shadow-purple-glow-intense focus:outline-none transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
