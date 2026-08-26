import React from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  Receipt, 
  Sparkles, 
  Banknote, 
  ShieldCheck, 
  Bell 
} from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';

interface MobileNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  unreadCount?: number;
  hasAdminAccess?: boolean;
  isSuperAdmin?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onNavigate,
  unreadCount = 0,
  hasAdminAccess = false,
  isSuperAdmin = false,
}) => {
  const { t } = useTranslation();

  // Super Admin is never a member of any Ekub -- the member-facing
  // personal tabs (Dashboard, Contributions, Draws) don't apply to them.
  // When signed in as Super Admin, render a focused admin-only mobile nav
  // that points straight to the Admin Center, Disputes, and Legal.
  if (isSuperAdmin) {
    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1C1132] border-t-2 border-[#7856FF]/30 px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onNavigate('admin')}
          className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
            activeTab === 'admin' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
          }`}
        >
          <div className="relative">
            <ShieldCheck className="w-5 h-5" />
            <span className="w-1.5 h-1.5 bg-[#7856FF] rounded-full absolute -top-0.5 -right-0.5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Admin Center</span>
        </button>

        <button
          onClick={() => onNavigate('disputes')}
          className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
            activeTab === 'disputes' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Disputes</span>
        </button>
      </div>
    );
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1C1132] border-t-2 border-[#7856FF]/30 px-3 py-2 flex items-center justify-around shadow-lg">
      
      {/* Dashboard */}
      <button
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
          activeTab === 'dashboard' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.dashboard}</span>
      </button>

      {/* Contributions */}
      <button
        onClick={() => onNavigate('contributions')}
        className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
          activeTab === 'contributions' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
        }`}
      >
        <Receipt className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.contributions}</span>
      </button>

      {/* Live Draws (Highlighted Center Action) */}
      <button
        onClick={() => onNavigate('draws')}
        className="flex flex-col items-center justify-center -mt-4"
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-[#C4B5FD] transition-transform active:scale-95 ${
          activeTab === 'draws' ? 'bg-[#7856FF] text-white ring-4 ring-[#7856FF]/30' : 'bg-[#7856FF] text-white'
        }`}>
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
          activeTab === 'draws' ? 'text-[#C4B5FD]' : 'text-white/75'
        }`}>
          {t.draws}
        </span>
      </button>

      {/* Payouts */}
      <button
        onClick={() => onNavigate('payouts')}
        className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
          activeTab === 'payouts' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
        }`}
      >
        <Banknote className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.payouts}</span>
      </button>

      {/* Admin Panel (If privileged) OR Discover */}
      {hasAdminAccess ? (
        <button
          onClick={() => onNavigate('admin')}
          className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
            activeTab === 'admin' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
          }`}
        >
          <div className="relative">
            <ShieldCheck className="w-5 h-5" />
            <span className="w-1.5 h-1.5 bg-[#7856FF] rounded-full absolute -top-0.5 -right-0.5" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.admin}</span>
        </button>
      ) : (
        <button
          onClick={() => onNavigate('discover')}
          className={`flex flex-col items-center justify-center p-1 rounded transition-colors ${
            activeTab === 'discover' ? 'text-[#C4B5FD]' : 'text-white/60 hover:text-white'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.discover}</span>
        </button>
      )}

    </div>
  );
};
