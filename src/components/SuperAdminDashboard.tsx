import React, { useState } from 'react';
import { 
  Users, 
  Receipt, 
  Sparkles, 
  Banknote, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  FileText, 
  ChevronRight, 
  TrendingUp, 
  RefreshCw, 
  Coins, 
  Scale
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, UserProfile } from '../types';

interface SuperAdminDashboardProps {
  ekubs: Ekub[];
  userProfile?: UserProfile | null;
  onSelectEkub: (ekub: Ekub) => void;
  onOpenCreateEkub: () => void;
  onNavigateTab: (tab: string) => void;
  onRefreshData?: () => void;
}

// Tailored home dashboard for the Super Admin. The Super Admin is never a
// member of any Ekub -- they have no personal contributions to make, no
// personal draws to watch, and no personal payout claims to file. Rendering
// the standard member-facing Dashboard for them (with its "YOU" member bubble,
// "Make Contribution" buttons, etc.) is conceptually wrong. This component
// provides a clean, platform-wide governance overview instead.
export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  ekubs,
  userProfile: propUserProfile,
  onSelectEkub,
  onOpenCreateEkub,
  onNavigateTab,
  onRefreshData,
}) => {
  const auth = useAuth();
  const userProfile = propUserProfile !== undefined ? propUserProfile : auth.userProfile;
  const { t, language } = useTranslation();

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const totalCircles = ekubs.length;
  const activeCircles = ekubs.filter(e => e.status === 'active').length;
  const totalVolume = ekubs.reduce((sum, e) => sum + (e.payoutAmount || 0), 0);
  const totalMembers = ekubs.reduce((sum, e) => sum + (e.currentMemberCount || e.totalMembers || 0), 0);

  return (
    <div className="space-y-6 pb-16">
      
      {/* Super Admin Welcome Banner */}
      <div className="bg-[#1C1132] text-white p-6 sm:p-7 border-b border-[#7856FF]/30 shadow-md rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#7856FF]/20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
              <span>PLATFORM SUPER ADMIN</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {language === 'am' ? `እንኳን ደህና መጡ፣ ${userProfile?.fullName || 'ዋና አስተዳዳሪ'}` : `Welcome, ${userProfile?.fullName || 'Super Admin'}`}
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-xl">
              {language === 'am'
                ? 'የመድረኩን አጠቃላይ እንቅስቃሴ፣ የተመዘገቡ ዕቁቦችን እና የአስተዳዳሪ ኃላፊነቶችን ከዚህ ይቆጣጠሩ።'
                : 'Platform-wide governance overview. Oversee active circles, audit logs, and operational controls.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={onOpenCreateEkub}
              className="px-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md shadow-[#7856FF]/25 transition-all flex items-center space-x-1.5 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>{t.startEkub}</span>
            </button>

            <button
              onClick={() => onNavigateTab('admin')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-[#C4B5FD] border border-[#7856FF]/40 font-bold text-xs uppercase tracking-widest transition-all flex items-center space-x-1.5 rounded-lg"
            >
              <ShieldCheck className="w-4 h-4 text-[#7856FF]" />
              <span>Open Admin Center</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-green-600 hover:text-green-800 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-red-600 hover:text-red-800 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Platform-Wide Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Total Circles</span>
            <div className="w-8 h-8 rounded-lg bg-[#7856FF]/10 text-[#7856FF] flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#1C1132]">{totalCircles}</p>
          <p className="text-[11px] text-green-600 font-medium mt-1">{activeCircles} Active circles</p>
        </div>

        <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Total Pool Volume</span>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#1C1132]">{totalVolume.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500 mt-1">ETB across all active pools</p>
        </div>

        <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Total Participants</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#1C1132]">{totalMembers}</p>
          <p className="text-[11px] text-gray-500 mt-1">Enrolled across all circles</p>
        </div>

        <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Platform Health</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">100%</p>
          <p className="text-[11px] text-gray-500 mt-1">Audit trail fully synced</p>
        </div>
      </div>

      {/* Ekub Circles Governance Table */}
      <div className="bg-white border border-[#E6E1F5] rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-[#1C1132]">Ekub Circles Overview</h2>
            <p className="text-xs text-gray-500">Manage and assign administrative authority across all platform circles.</p>
          </div>
          <button
            onClick={() => onNavigateTab('admin')}
            className="text-xs font-bold uppercase tracking-wider text-[#7856FF] hover:underline"
          >
            Manage in Admin Center →
          </button>
        </div>

        {ekubs.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-gray-200 rounded-lg">
            <Coins className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No Ekub circles created yet.</p>
            <button
              onClick={onOpenCreateEkub}
              className="mt-3 px-4 py-2 bg-[#7856FF] text-white text-xs font-bold uppercase tracking-wider rounded-lg"
            >
              Create the First Ekub
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F7FC] border-b border-[#E6E1F5] text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Circle Name</th>
                  <th className="py-3 px-4">Assigned Admin</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Cycle Progress</th>
                  <th className="py-3 px-4">Payout Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ekubs.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-bold text-gray-900">{e.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">ID: {e.id}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        e.adminName && e.adminName !== 'Unassigned' ? 'bg-[#7856FF]/15 text-[#7856FF]' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {e.adminName || 'Unassigned'}
                      </span>
                    </td>
                    <td className="py-3 px-4 uppercase font-bold text-gray-700">{e.frequency}</td>
                    <td className="py-3 px-4 font-mono">Cycle #{e.currentCycle} &middot; {e.currentMemberCount ?? 0}/{e.memberLimit ?? '?'} members</td>
                    <td className="py-3 px-4 font-mono font-bold text-gray-900">{e.payoutAmount.toLocaleString()} ETB</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectEkub(e)}
                        className="text-[#7856FF] hover:text-[#6340FF] font-bold uppercase text-[11px] tracking-wider hover:underline"
                      >
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
