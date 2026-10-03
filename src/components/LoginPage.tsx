import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  UserCheck,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Phone,
  MapPin,
  CheckCircle2,
  KeyRound,
  Home,
  Users,
} from 'lucide-react';
import { UserProfile } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  profiles: UserProfile[];
  onLogin: (user: UserProfile) => void;
}

export const LoginPage: React.FC<Props> = ({ profiles, onLogin }) => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pre-configured Quick Accounts
  const quickAccounts: {
    id: string;
    label: string;
    roleDesc: string;
    badge: string;
    badgeColor: string;
    email: string;
    phone: string;
    user: UserProfile;
  }[] = [
    {
      id: 'manager-russell',
      label: 'Russell (Manager)',
      roleDesc: 'Super Admin ERP • Complete Property Access',
      badge: 'Manager',
      badgeColor: 'bg-blue-600 text-white',
      email: 'akandarussell@gmail.com',
      phone: COMPLEX_CONFIG.managerPhone,
      user: profiles[0] || {
        id: 'user-manager-russell',
        email: 'akandarussell@gmail.com',
        fullName: 'Russell (Manager)',
        phone: COMPLEX_CONFIG.managerPhone,
        role: 'manager',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'owner-rashed',
      label: 'Rashed (Block A Owner)',
      roleDesc: 'Block A Wings • Units A1-A8 Access',
      badge: 'Owner Block A',
      badgeColor: 'bg-emerald-600 text-white',
      email: 'rashed.blocka@mbdapartment.com',
      phone: '01712-345678',
      user: profiles[1] || {
        id: 'user-owner-rashed-a',
        email: 'rashed.blocka@mbdapartment.com',
        fullName: 'Rashed (Block A Owner)',
        phone: '01712-345678',
        role: 'owner',
        assignedBlock: 'Block A',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'owner-raju',
      label: 'Raju (Block B Owner)',
      roleDesc: 'Block B Wings • Units B1-B7 Access',
      badge: 'Owner Block B',
      badgeColor: 'bg-indigo-600 text-white',
      email: 'raju.blockb@mbdapartment.com',
      phone: COMPLEX_CONFIG.rajuPhone,
      user: profiles[2] || {
        id: 'user-owner-raju-b',
        email: 'raju.blockb@mbdapartment.com',
        fullName: 'Raju (Block B Owner)',
        phone: COMPLEX_CONFIG.rajuPhone,
        role: 'owner',
        assignedBlock: 'Block B',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'owner-rony',
      label: 'Rony (Block C Owner)',
      roleDesc: 'Block C Wings • Units C1-C7 Access',
      badge: 'Owner Block C',
      badgeColor: 'bg-purple-600 text-white',
      email: 'rony.blockc@mbdapartment.com',
      phone: '01714-567890',
      user: profiles[3] || {
        id: 'user-owner-rony-c',
        email: 'rony.blockc@mbdapartment.com',
        fullName: 'Rony (Block C Owner)',
        phone: '01714-567890',
        role: 'owner',
        assignedBlock: 'Block C',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'tenant-tanvir',
      label: 'Tanvir Ahmed Chy',
      roleDesc: 'Resident • Flat A2 • Personal Bills & Receipts',
      badge: 'Tenant (Flat A2)',
      badgeColor: 'bg-amber-600 text-white',
      email: 'tanvir.a2@gmail.com',
      phone: '01819-223344',
      user: {
        id: 't-a2',
        email: 'tanvir.a2@gmail.com',
        fullName: 'Tanvir Ahmed Chy',
        phone: '01819-223344',
        role: 'tenant',
        flatId: 'A2',
        isActive: true,
        createdAt: '2024-03-01',
      },
    },
    {
      id: 'tenant-farhana',
      label: 'Farhana Begum',
      roleDesc: 'Resident • Flat B3 • Personal Bills & Receipts',
      badge: 'Tenant (Flat B3)',
      badgeColor: 'bg-teal-600 text-white',
      email: 'farhana.b3@gmail.com',
      phone: '01922-345678',
      user: {
        id: 't-b3',
        email: 'farhana.b3@gmail.com',
        fullName: 'Farhana Begum',
        phone: '01922-345678',
        role: 'tenant',
        flatId: 'B3',
        isActive: true,
        createdAt: '2024-05-01',
      },
    },
  ];

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const input = emailOrPhone.trim().toLowerCase();
    if (!input) {
      setErrorMsg('Please enter your email or registered phone number.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setIsLoading(true);

    // Match profile by email or phone
    const matched =
      profiles.find(
        (p) => p.email.toLowerCase() === input || p.phone.replace(/[^0-9]/g, '') === input.replace(/[^0-9]/g, '')
      ) ||
      quickAccounts.find(
        (q) => q.email.toLowerCase() === input || q.phone.replace(/[^0-9]/g, '') === input.replace(/[^0-9]/g, '')
      )?.user;

    setTimeout(() => {
      setIsLoading(false);
      if (matched) {
        if (!matched.isActive) {
          setErrorMsg('This account has been deactivated. Please contact management.');
          return;
        }
        onLogin(matched);
      } else {
        // Fallback demo matching: If username includes "manager" or "admin", sign in as Manager
        if (input.includes('admin') || input.includes('manager') || input.includes('russell')) {
          onLogin(profiles[0]);
        } else if (input.includes('rashed') || input.includes('a')) {
          onLogin(profiles[1]);
        } else if (input.includes('raju') || input.includes('b')) {
          onLogin(profiles[2]);
        } else if (input.includes('rony') || input.includes('c')) {
          onLogin(profiles[3]);
        } else {
          setErrorMsg(
            'Account not found. Please select one of the Quick Login demo accounts below or check your credentials.'
          );
        }
      }
    }, 350);
  };

  const handleQuickLogin = (acc: (typeof quickAccounts)[0]) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(acc.user);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Brand Banner */}
      <header className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-md tracking-wider shrink-0">
              MBD
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight block text-white">
                {COMPLEX_CONFIG.name.toUpperCase()}
              </span>
              <span className="text-[11px] text-blue-300 block font-medium">
                {COMPLEX_CONFIG.address}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span>Hotlines: <strong className="text-white">{COMPLEX_CONFIG.contacts}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Login Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Left Side: Apartment Complex Overview */}
        <div className="flex-1 max-w-lg space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Residential Property ERP &bull; Rajshahi-6201</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Apartment Management System
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed">
            Welcome to the centralized financial, rental, and utility management portal of{' '}
            <strong className="text-white">{COMPLEX_CONFIG.name}</strong>.
            Sign in to access your designated role portal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left text-xs">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
              <div className="font-bold text-blue-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> 3 Residential Wings
              </div>
              <p className="text-slate-400 text-[11px]">
                Block A (Rashed), Block B (Raju), Block C (Rony)
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Home className="w-4 h-4" /> 22 Units & Utilities
              </div>
              <p className="text-slate-400 text-[11px]">
                NESCO submetering, Advance escrow & 14-Col Ledger
              </p>
            </div>
          </div>

          {/* Quick Hotline Contacts card */}
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-900/60 text-xs text-slate-300 space-y-1.5">
            <p className="font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400" /> Emergency & Management Contacts
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-slate-400">
              <span>Manager Russell: <a href="tel:01737-321998" className="text-blue-400 font-bold hover:underline">01737-321998</a></span>
              <span className="hidden sm:inline">&bull;</span>
              <span>Owner Raju: <a href="tel:01913-858775" className="text-blue-400 font-bold hover:underline">01913-858775</a></span>
            </div>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          <div className="mb-6">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Sign In to Your Account
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your registered email or phone to access the portal
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Email or Mobile Number
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. akandarussell@gmail.com or 01737-321998"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-blue-700 font-semibold cursor-pointer hover:underline">
                  Default: manager123
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-slate-600 font-medium">Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mt-2"
            >
              {isLoading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Role Login Presets */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Quick 1-Click Role Login</span>
              <span className="text-blue-600 font-semibold normal-case">Fast Testing</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleQuickLogin(acc)}
                  className="p-2.5 text-left border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 group-hover:text-blue-700 text-xs">
                      {acc.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${acc.badgeColor}`}>
                      {acc.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {acc.email}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Complex Permanent Footer */}
      <footer className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <p className="font-bold text-slate-200">{COMPLEX_CONFIG.name}</p>
            <p className="text-[11px] text-slate-500">{COMPLEX_CONFIG.address}</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Apartment ERP &bull; Secured with Role-Based Access Control
          </p>
        </div>
      </footer>
    </div>
  );
};
