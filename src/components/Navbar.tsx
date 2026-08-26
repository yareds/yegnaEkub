import React, { useState } from 'react';
import { 
  Coins, 
  LayoutDashboard, 
  Layers, 
  Compass, 
  Receipt, 
  Sparkles, 
  Banknote, 
  ShieldCheck, 
  HelpCircle, 
  Bell, 
  Globe, 
  ChevronDown, 
  LogOut, 
  Check, 
  Menu, 
  X,
  Scale
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { AppNotification } from '../types';
import { YegnaEkubLogo } from './YegnaEkubLogo';

interface NavbarProps {
  currentTab?: string;
  activeTab?: string;
  setCurrentTab?: (tab: string) => void;
  onNavigate?: (tab: string) => void;
  notifications?: AppNotification[];
  unreadCount?: number;
  onOpenNotifications: () => void;
  onOpenCreateEkub?: () => void;
  onOpenJoinEkub?: () => void;
  onOpenLegal: () => void;
  hasAdminAccess?: boolean;
  isEkubAdminOfAny?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab: currentTabProp,
  activeTab: activeTabProp,
  setCurrentTab: setCurrentTabProp,
  onNavigate: onNavigateProp,
  notifications = [],
  unreadCount: unreadCountProp,
  onOpenNotifications,
  onOpenCreateEkub,
  onOpenJoinEkub,
  onOpenLegal,
  hasAdminAccess = false,
  isEkubAdminOfAny = false,
}) => {
  const currentTab = activeTabProp || currentTabProp || 'dashboard';
  const setCurrentTab = onNavigateProp || setCurrentTabProp || (() => {});
  const { userProfile, signOut, isAdmin } = useAuth();

  // Three real roles, not two: isAdmin means Super Admin specifically.
  // Someone can also be the assigned admin of a specific Ekub without
  // being Super Admin -- that's "Ekub Admin," a distinct role that
  // deserves its own label rather than being shown as a plain member.
  const roleLabel = isAdmin ? 'Super Admin' : isEkubAdminOfAny ? 'Ekub Admin' : 'Verified Member';

  // The Super Admin's "home" is the Admin Center, not the member-facing
  // Dashboard -- they're never a member of any Ekub, so there's nothing
  // personal to show them there.
  const homeTab = isAdmin ? 'admin' : 'dashboard';
  const { language, toggleLanguage, t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = unreadCountProp !== undefined 
    ? unreadCountProp 
    : (Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0);

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#1C1132] text-white border-b-2 border-[#7856FF]/30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          
          {/* Refined Brand Logo with Creative Growth 'k' */}
          <div className="flex items-center cursor-pointer" onClick={() => setCurrentTab(homeTab)}>
            <YegnaEkubLogo
              variant="full"
              size="sm"
              theme="dark"
              showSubtext={true}
              subtextText={language === 'am' ? 'ዲጂታል ዕቁብ' : 'DIGITAL ROSCA'}
            />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-6 text-xs font-semibold uppercase tracking-widest">
            {/* The Super Admin's landing view is the Admin Center (below),
                not this member-facing Dashboard -- hide the separate link
                for them so there's no route back into member-only content. */}
            {!isAdmin && (
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`transition-all py-1 ${
                  currentTab === 'dashboard'
                    ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {t.dashboard}
              </button>
            )}

            {/* Discover / Contributions / Draws / Payouts are member-facing
                personal views (find a circle, my ledger, watch a draw, my
                payouts). The Super Admin is never a member of any circle,
                so none of these apply to them -- their equivalent views
                live inside the Admin Center's platform-wide tabs instead. */}
            {!isAdmin && (
              <>
                <button
                  onClick={() => setCurrentTab('discover')}
                  className={`transition-all py-1 ${
                    currentTab === 'discover'
                      ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  {t.discover}
                </button>

                <button
                  onClick={() => setCurrentTab('contributions')}
                  className={`transition-all py-1 ${
                    currentTab === 'contributions'
                      ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  {t.contributions}
                </button>

                <button
                  onClick={() => setCurrentTab('draws')}
                  className={`transition-all py-1 flex items-center space-x-1 ${
                    currentTab === 'draws'
                      ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  <span>{t.draws}</span>
                  <span className="w-1.5 h-1.5 bg-[#7856FF] rounded-full animate-pulse" />
                </button>

                <button
                  onClick={() => setCurrentTab('payouts')}
                  className={`transition-all py-1 ${
                    currentTab === 'payouts'
                      ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                      : 'text-white/75 hover:text-white'
                  }`}
                >
                  {t.payouts}
                </button>
              </>
            )}

            {hasAdminAccess && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`transition-all py-1 px-2.5 rounded-sm text-[11px] font-bold ${
                  currentTab === 'admin'
                    ? 'bg-[#7856FF] text-white shadow-sm'
                    : 'bg-white/10 text-[#C4B5FD] hover:bg-[#7856FF] hover:text-white'
                }`}
              >
                {t.admin}
              </button>
            )}

            <button
              onClick={() => setCurrentTab('disputes')}
              className={`transition-all py-1 ${
                currentTab === 'disputes'
                  ? 'border-b-2 border-[#7856FF] text-[#C4B5FD] font-bold'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              {t.disputes}
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-[#2B1B48] hover:bg-[#37235C] text-[#F5F2FF] border border-[#7856FF]/30 transition-colors"
              title="Toggle Language / ቋንቋ ቀይር"
            >
              <Globe className="w-3.5 h-3.5 text-[#C4B5FD]" />
              <span>{t.switchLanguage}</span>
            </button>

            {/* In-App Notifications Icon */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-sm bg-[#2B1B48] hover:bg-[#37235C] text-[#F5F2FF] border border-[#7856FF]/30 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#7856FF] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#1C1132]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Persona Switcher & Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2.5 pl-2 pr-2.5 py-1 rounded-sm bg-[#2B1B48] hover:bg-[#37235C] border border-[#7856FF]/30 text-xs transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#1C1132] border-2 border-[#7856FF] text-[#C4B5FD] font-bold flex items-center justify-center text-xs">
                  {userProfile?.fullName ? userProfile.fullName.charAt(0) : 'Y'}
                </div>
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs text-white/80 font-medium truncate max-w-[110px]">
                    {userProfile?.fullName || 'Member'}
                  </span>
                  <span className="text-[9px] text-[#C4B5FD] font-bold tracking-wider uppercase">
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/60" />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div 
                  className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-2xl py-2 z-50 border border-[#E6E1F5] text-gray-800 animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="px-4 py-3 border-b border-gray-100 bg-[#F8F7FC]">
                    <p className="text-[10px] uppercase tracking-widest text-[#7856FF] font-bold">Active Profile</p>
                    <p className="font-bold text-gray-900 text-sm mt-0.5">{userProfile?.fullName}</p>
                    <p className="text-xs text-gray-600 truncate">{userProfile?.email}</p>
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#7856FF]/15 text-[#7856FF] border border-[#7856FF]/30">
                      {roleLabel}
                    </span>
                  </div>

                  <div className="px-2 py-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenLegal();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-sm text-xs text-gray-700 hover:bg-gray-100 transition-colors uppercase tracking-wider font-semibold text-[11px]"
                    >
                      <Scale className="w-3.5 h-3.5 text-[#7856FF]" />
                      <span>Legal, Terms & Disclosures</span>
                    </button>

                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await signOut();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-sm text-xs text-red-600 hover:bg-red-50 transition-colors uppercase tracking-wider font-semibold text-[11px]"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-sm bg-[#2B1B48] lg:hidden text-white hover:bg-[#37235C] border border-[#7856FF]/30"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#22153D] border-t-2 border-[#7856FF] px-4 pt-3 pb-5 space-y-1.5 text-xs uppercase tracking-widest font-semibold">
          {!isAdmin && (
            <button
              onClick={() => { setCurrentTab('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
                currentTab === 'dashboard' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t.dashboard}</span>
            </button>
          )}

          {!isAdmin && (
            <>
              <button
                onClick={() => { setCurrentTab('discover'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
                  currentTab === 'discover' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>{t.discover}</span>
              </button>

              <button
                onClick={() => { setCurrentTab('contributions'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
                  currentTab === 'contributions' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>{t.contributions}</span>
              </button>

              <button
                onClick={() => { setCurrentTab('draws'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
                  currentTab === 'draws' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
                <span>{t.draws}</span>
              </button>

              <button
                onClick={() => { setCurrentTab('payouts'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
                  currentTab === 'payouts' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>{t.payouts}</span>
              </button>
            </>
          )}

          {hasAdminAccess && (
            <button
              onClick={() => { setCurrentTab('admin'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm bg-[#7856FF] text-white font-bold`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t.admin}</span>
            </button>
          )}

          <button
            onClick={() => { setCurrentTab('disputes'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded-sm ${
              currentTab === 'disputes' ? 'bg-[#7856FF]/20 text-[#C4B5FD] border-l-4 border-[#7856FF]' : 'text-white/80 hover:bg-white/5'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{t.disputes}</span>
          </button>
        </div>
      )}
    </header>
  );
};
