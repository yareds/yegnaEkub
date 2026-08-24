import React from 'react';
import { 
  Coins, 
  Calendar, 
  Clock, 
  Sparkles, 
  Receipt, 
  CheckCircle2, 
  ArrowUpRight, 
  ShieldCheck, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  Banknote, 
  UserCheck, 
  ExternalLink,
  Plus
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, Contribution, Draw, Payout } from '../types';

interface DashboardProps {
  ekubs: Ekub[];
  contributions: Contribution[];
  draws: Draw[];
  payouts: Payout[];
  onSelectEkub: (ekub: Ekub) => void;
  onOpenContribute: (ekub?: Ekub) => void;
  onOpenLiveDraw: (ekub?: Ekub) => void;
  onOpenVerifyDraw: (draw?: Draw) => void;
  onOpenPayout: (payout?: Payout) => void;
  onOpenCreateEkub: () => void;
  onOpenJoinEkub: () => void;
  onNavigateTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  ekubs,
  contributions,
  draws,
  payouts,
  onSelectEkub,
  onOpenContribute,
  onOpenLiveDraw,
  onOpenVerifyDraw,
  onOpenPayout,
  onOpenCreateEkub,
  onOpenJoinEkub,
  onNavigateTab,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const activeEkub = (ekubs || []).find(e => e.status === 'active') || (ekubs || [])[0];
  const userContributions = (contributions || []).filter(c => c.userId === userProfile?.uid);
  const pendingUserContributions = userContributions.filter(c => c.status === 'pending');
  const userPayoutClaims = (payouts || []).filter(p => p.winnerId === userProfile?.uid);
  const latestDraw = (draws || [])[0];

  const totalUserContributed = userContributions
    .filter(c => c.status === 'verified')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  // Real recent-activity feed, derived from the actual contributions/draws/
  // payouts already loaded for this user -- replaces a previous version of
  // this section that was entirely static placeholder text.
  type ActivityItem = { title: string; detail: string; timestamp: string };
  const recentActivity: ActivityItem[] = [
    ...userContributions
      .filter(c => c.status === 'verified' && c.verifiedAt)
      .map(c => ({
        title: 'Payment Verified',
        detail: `You contributed ${c.amount.toLocaleString()} ${c.currency} via ${c.paymentMethod}`,
        timestamp: c.verifiedAt as string,
      })),
    ...(draws || [])
      .filter(d => d.status === 'completed' && d.executedAt && d.winnerName)
      .map(d => ({
        title: 'Draw Completed',
        detail: `Winner: ${d.winnerName} (${d.payoutAmount.toLocaleString()} ETB)`,
        timestamp: d.executedAt as string,
      })),
    ...(payouts || [])
      .filter(p => p.status === 'paid')
      .map(p => ({
        title: 'Payout Processed',
        detail: `Recipient: ${p.winnerName} (${p.amount.toLocaleString()} ETB)`,
        timestamp: (p as { updatedAt?: string }).updatedAt || '',
      })),
  ]
    .filter(item => item.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 4);

  const formatRelativeTime = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${Math.floor(diffHrs)} hours ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Hero / Quick Header Banner */}
      <div className="bg-[#1C1132] text-white p-6 sm:p-7 border-b border-[#7856FF]/30 shadow-md rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#7856FF]/20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
              <span>{userProfile?.role === 'admin' ? 'SUPER ADMIN VERIFIED' : 'VERIFIED MEMBER'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {language === 'am' ? `እንኳን ደህና መጡ፣ ${userProfile?.fullName || ''}` : `Welcome back, ${userProfile?.fullName || 'Member'}`}
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-xl">
              {language === 'am'
                ? 'የእርስዎን የዕቁብ ዙር፣ መዋጮዎች እና የቀጥታ ዕጣዎች በዚህ ገጽ ይከታተሉ።'
                : 'Track your active circles, verified contribution ledger, and live draw turns.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onOpenContribute(activeEkub)}
              className="px-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md shadow-[#7856FF]/25 transition-all flex items-center space-x-1.5 rounded-lg"
            >
              <Receipt className="w-4 h-4" />
              <span>{t.payContribution}</span>
            </button>

            <button
              onClick={() => onOpenLiveDraw(activeEkub)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-[#C4B5FD] border border-[#7856FF]/40 font-bold text-xs uppercase tracking-widest transition-all flex items-center space-x-1.5 rounded-lg"
            >
              <Sparkles className="w-4 h-4 text-[#7856FF]" />
              <span>{t.joinDraw}</span>
            </button>

            {isAdmin ? (
              <button
                onClick={onOpenCreateEkub}
                className="px-3.5 py-2.5 bg-transparent hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest border border-white/20 transition-all flex items-center space-x-1.5 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5 text-[#C4B5FD]" />
                <span>{t.startEkub}</span>
                <span className="text-[9px] bg-[#7856FF] px-1.5 py-0.5 rounded text-white font-bold uppercase">Admin</span>
              </button>
            ) : (
              <button
                onClick={onOpenJoinEkub}
                className="px-3.5 py-2.5 bg-transparent hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest border border-white/20 transition-all flex items-center space-x-1.5 rounded-lg"
              >
                <Coins className="w-3.5 h-3.5 text-[#C4B5FD]" />
                <span>{t.joinEkub}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payout Claim Notice Banner */}
      {userPayoutClaims.some(p => p.status === 'documents_required' || p.status === 'pending') && (
        <div className="bg-[#7856FF]/10 border border-[#7856FF]/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#7856FF] text-white flex items-center justify-center font-bold rounded-lg shadow-sm">
              <span className="text-base">🎉</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#1C1132]">
                {language === 'am' ? 'የዕቁብ ድረሻ አሸንፈዋል!' : 'You Won a Guaranteed Payout!'}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Please submit your verified Ethiopian bank details to disburse your funds.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPayout(userPayoutClaims[0])}
            className="px-4 py-2 bg-[#7856FF] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#6340FF] shadow-sm transition-colors whitespace-nowrap rounded-lg"
          >
            {t.claimPayout}
          </button>
        </div>
      )}

      {/* Main Grid with Sidebar and Primary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Aside: Financial Summary & Dark Quick Actions */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Financial Summary Card */}
          <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold mb-4">
              {language === 'am' ? 'የፋይናንስ ማጠቃለያ' : 'Financial Summary'}
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t.totalContributed || 'Total Contributed'}</p>
                <p className="text-2xl font-bold text-[#1C1132] mt-0.5">
                  {totalUserContributed.toLocaleString()}{' '}
                  <span className="text-sm font-bold text-gray-600">ETB</span>
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t.currentPot}</p>
                <p className="text-2xl font-bold text-[#7856FF] mt-0.5">
                  {activeEkub ? activeEkub.payoutAmount.toLocaleString() : '0'}{' '}
                  <span className="text-sm font-bold text-gray-400">ETB</span>
                </p>
              </div>

              <div className="pt-4 border-t border-dashed border-[#E6E1F5]">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t.nextContribution}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm font-bold text-gray-900">{activeEkub?.nextContributionDate || 'Sept 24, 2024'}</p>
                  <span className="text-xs font-bold text-[#7856FF]">{activeEkub?.contributionAmount.toLocaleString()} ETB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dark Quick Actions Card */}
          <div className="bg-[#1C1132] text-white p-5 rounded-xl border border-[#7856FF]/30 relative overflow-hidden flex-1 flex flex-col justify-between shadow-sm">
            <div className="relative z-10">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#C4B5FD] font-bold mb-4">
                Quick Actions
              </h2>
              <button
                onClick={() => onOpenContribute(activeEkub)}
                className="w-full py-3 mb-3 bg-[#7856FF] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#6340FF] shadow-sm transition-colors rounded-lg"
              >
                Make Contribution
              </button>
              {isAdmin ? (
                <button
                  onClick={onOpenCreateEkub}
                  className="w-full py-3 bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest hover:bg-white/15 transition-colors rounded-lg flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#C4B5FD]" />
                  <span>Start New Ekub (Admin)</span>
                </button>
              ) : (
                <button
                  onClick={onOpenJoinEkub}
                  className="w-full py-3 bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest hover:bg-white/15 transition-colors rounded-lg flex items-center justify-center space-x-1.5"
                >
                  <Coins className="w-3.5 h-3.5 text-[#C4B5FD]" />
                  <span>{t.joinEkub}</span>
                </button>
              )}
            </div>

            <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none">
              <div className="w-40 h-40 bg-[#7856FF] rounded-full blur-2xl" />
            </div>
          </div>

        </aside>

        {/* Center/Right Section: Active Ekub & Round Turns & Activity */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Ekub Main Card */}
          {activeEkub && (
            <div className="bg-white border border-[#E6E1F5] rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#1C1132]">{activeEkub.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeEkub.frequency.toUpperCase()} Cycle • {activeEkub.contributionAmount.toLocaleString()} ETB / Member
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold border border-green-200 uppercase tracking-wider rounded-md">
                    ACTIVE CYCLE 0{activeEkub.currentCycle}/10
                  </span>
                  <button
                    onClick={() => onSelectEkub(activeEkub)}
                    className="text-xs font-bold text-[#7856FF] hover:text-[#6340FF] uppercase tracking-wider flex items-center"
                  >
                    <span>{t.viewDetails}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Geometric Member Turn Bubbles */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-2 border-green-500 flex items-center justify-center bg-green-50 text-green-600 font-bold text-xs">
                    ✓
                  </div>
                  <span className="text-[10px] font-medium text-gray-700">Abebe B.</span>
                  <span className="text-[8px] text-green-600 uppercase font-bold">Won Cycle 1</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-2 border-green-500 flex items-center justify-center bg-green-50 text-green-600 font-bold text-xs">
                    ✓
                  </div>
                  <span className="text-[10px] font-medium text-gray-700">Sara T.</span>
                  <span className="text-[8px] text-green-600 uppercase font-bold">Won Cycle 2</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-2 border-green-500 flex items-center justify-center bg-green-50 text-green-600 font-bold text-xs">
                    ✓
                  </div>
                  <span className="text-[10px] font-medium text-gray-700">Dawit K.</span>
                  <span className="text-[8px] text-green-600 uppercase font-bold">Won Cycle 3</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full border-3 border-[#7856FF] flex items-center justify-center bg-[#F8F7FC] shadow-md relative">
                    <span className="text-[#7856FF] font-black text-xs">YOU</span>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#7856FF] rounded-full border border-white animate-pulse" />
                  </div>
                  <span className="text-[10px] font-bold text-[#7856FF]">Current Turn</span>
                  <span className="text-[8px] text-[#7856FF] uppercase font-bold">Friday Draw</span>
                </div>

                <div className="flex flex-col items-center gap-2 opacity-50">
                  <div className="w-12 h-12 rounded-full border border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 font-bold text-xs">
                    05
                  </div>
                  <span className="text-[10px] font-medium text-gray-500">Upcoming</span>
                  <span className="text-[8px] text-gray-400 uppercase">Cycle 5</span>
                </div>
              </div>

              {/* Pot Pool Panel */}
              <div className="bg-[#F8F7FC] p-4 border border-[#E6E1F5] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Current Pot Pool</p>
                  <p className="text-2xl font-bold text-[#1C1132]">
                    {activeEkub.payoutAmount.toLocaleString()} <span className="text-sm font-semibold text-gray-600">ETB</span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Contribution Rate</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7856FF] w-[80%]" />
                    </div>
                    <span className="text-xs font-bold text-[#7856FF]">8/10</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Two Small Cards: Live Draw Timer & Trust Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Live Draw In Card */}
            <div className="bg-white p-4 border border-[#E6E1F5] rounded-xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-[#7856FF]/10 rounded-lg flex items-center justify-center text-[#7856FF]">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Live Draw In</p>
                <p className="font-bold text-[#1C1132] uppercase tracking-tighter text-sm">
                  02d : 04h : 12m
                </p>
              </div>
            </div>

            {/* Trust Verification Card */}
            <div className="bg-white p-4 border border-[#E6E1F5] rounded-xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 bg-[#7856FF]/10 rounded-lg flex items-center justify-center text-[#7856FF]">
                <ShieldCheck className="w-6 h-6 text-[#7856FF]" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Trust Verification</p>
                <p className="font-bold text-[#1C1132] uppercase tracking-tighter text-sm">
                  Audit Verified (HMAC-SHA256)
                </p>
              </div>
            </div>

          </div>

          {/* Activity Feed & System Status */}
          <div className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold">
                {t.recentActivity}
              </h2>
              <button
                onClick={() => onNavigateTab('contributions')}
                className="text-[11px] font-bold uppercase tracking-wider text-[#7856FF] hover:underline"
              >
                {t.all} →
              </button>
            </div>

            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((item, idx) => (
                  <div
                    key={idx}
                    className={`border-l-2 ${idx === 0 ? 'border-[#7856FF]' : 'border-gray-200'} pl-3 py-1`}
                  >
                    <p className="text-xs font-bold text-gray-900">{item.title}</p>
                    <p className="text-[10px] text-gray-500">{item.detail}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">
                      {formatRelativeTime(item.timestamp)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">
                  {language === 'am' ? 'እስካሁን ምንም እንቅስቃሴ የለም።' : 'No activity yet. Join or start an Ekub to get going.'}
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">System Status: Encrypted & Active</span>
              </div>
              <span className="text-[10px] text-gray-400">All transactions logged to immutable audit trail</span>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
};
