import React from 'react';
import { LayoutDashboard, Layers, Receipt, Sparkles, Banknote, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';

interface MobileNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  unreadCount?: number;
  hasAdminAccess?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onNavigate, hasAdminAccess }) => {
  const { t, language } = useTranslation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E6E1F5] px-2 py-2 shadow-lg flex items-center justify-around">
      <button
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
          activeTab === 'dashboard' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
        <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'ዋና' : 'Home'}</span>
        {activeTab === 'dashboard' && (
          <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
        )}
      </button>

      <button
        onClick={() => onNavigate('discover')}
        className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
          activeTab === 'discover' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
        }`}
      >
        <Layers className={`w-5 h-5 ${activeTab === 'discover' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
        <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'ዕቁብ' : 'Ekubs'}</span>
        {activeTab === 'discover' && (
          <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
        )}
      </button>

      <button
        onClick={() => onNavigate('contributions')}
        className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
          activeTab === 'contributions' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
        }`}
      >
        <Receipt className={`w-5 h-5 ${activeTab === 'contributions' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
        <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'መዋጮ' : 'Pay'}</span>
        {activeTab === 'contributions' && (
          <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
        )}
      </button>

      <button
        onClick={() => onNavigate('draws')}
        className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
          activeTab === 'draws' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
        }`}
      >
        <Sparkles className={`w-5 h-5 text-[#7856FF] ${activeTab === 'draws' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
        <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'ዕጣ' : 'Draws'}</span>
        {activeTab === 'draws' && (
          <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
        )}
      </button>

      <button
        onClick={() => onNavigate('payouts')}
        className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
          activeTab === 'payouts' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
        }`}
      >
        <Banknote className={`w-5 h-5 ${activeTab === 'payouts' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
        <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'ድረሻ' : 'Payouts'}</span>
        {activeTab === 'payouts' && (
          <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
        )}
      </button>

      {hasAdminAccess && (
        <button
          onClick={() => onNavigate('admin')}
          className={`flex flex-col items-center py-1 px-2.5 transition-colors relative ${
            activeTab === 'admin' ? 'text-[#7856FF] font-bold' : 'text-gray-400 hover:text-gray-800'
          }`}
        >
          <ShieldCheck className={`w-5 h-5 ${activeTab === 'admin' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[9px] uppercase tracking-wider mt-0.5">{language === 'am' ? 'አስተዳደር' : 'Admin'}</span>
          {activeTab === 'admin' && (
            <div className="w-1 h-1 bg-[#7856FF] rounded-full mt-0.5" />
          )}
        </button>
      )}
    </div>
  );
};
