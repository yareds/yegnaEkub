import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Calendar, 
  Users, 
  Sparkles, 
  Receipt, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  FileText,
  Lock
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, EkubMember, Draw } from '../types';
import { getEkubMembers } from '../firebase/ekubService';

interface EkubDetailProps {
  ekub: Ekub;
  draws: Draw[];
  onBack: () => void;
  onOpenContribute: (ekub: Ekub) => void;
  onOpenLiveDraw: (ekub: Ekub) => void;
  onOpenVerifyDraw: (draw: Draw) => void;
}

export const EkubDetail: React.FC<EkubDetailProps> = ({
  ekub,
  draws,
  onBack,
  onOpenContribute,
  onOpenLiveDraw,
  onOpenVerifyDraw,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const [members, setMembers] = useState<EkubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingMembers(true);
      const res = await getEkubMembers(ekub.id);
      setMembers(Array.isArray(res) ? res : []);
      setLoadingMembers(false);
    };
    load();
  }, [ekub.id]);

  const ekubDraws = (draws || []).filter(d => d.ekubId === ekub.id);
  const userMemberRecord = (members || []).find(m => m.userId === userProfile?.uid);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ekub.inviteCode || ekub.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#7856FF] hover:text-[#6340FF] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'am' ? 'ወደ ዋና ገጽ ተመለስ' : 'Back to Ekub List'}</span>
        </button>

        {ekub.inviteCode && (
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E6E1F5] rounded-xl text-gray-700 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-gray-50 shadow-xs"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#7856FF]" />}
            <span>Invite Code: <strong className="font-mono text-[#7856FF]">{ekub.inviteCode}</strong></span>
          </button>
        )}
      </div>

      {/* Main Header Card */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                {ekub.status}
              </span>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {ekub.frequency} Cycle
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1132]">
              {ekub.name}
            </h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
              {ekub.description}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {t.organizer}: <strong className="text-gray-800">{ekub.organizerName}</strong> • Created on {ekub.startDate}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onOpenContribute(ekub)}
              className="px-5 py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-98 transition-all flex items-center space-x-2"
            >
              <Receipt className="w-4 h-4 text-white" />
              <span>{t.payContribution}</span>
            </button>

            <button
              onClick={() => onOpenLiveDraw(ekub)}
              className="px-5 py-3 bg-[#1C1132] hover:bg-[#2A1B4A] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-98 transition-all flex items-center space-x-2 border border-[#7856FF]/30"
            >
              <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
              <span>{t.joinDraw}</span>
            </button>
          </div>
        </div>

        {/* 4-Cell Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#E6E1F5]">
          <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.amountDue}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {ekub.contributionAmount.toLocaleString()} ETB
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 capitalize">Per {ekub.frequency.replace('ly', '')}</p>
          </div>

          <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.currentPot}</p>
            <p className="text-base font-bold text-[#7856FF] mt-0.5">
              {ekub.payoutAmount.toLocaleString()} ETB
            </p>
            <p className="text-[10px] text-emerald-700 font-bold uppercase mt-0.5">Guaranteed Turn</p>
          </div>

          <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.members}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {members.length} / {ekub.memberLimit}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Full Capacity</p>
          </div>

          <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{t.nextDraw}</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              Friday 7:00 PM
            </p>
            <p className="text-[10px] text-amber-700 font-bold uppercase mt-0.5">Cycle #{ekub.currentCycle}</p>
          </div>
        </div>
      </div>

      {/* Visual Sequence & Turn Tracker (RoSCA Cycle) */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-[#7856FF] rounded-full" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1C1132]">{t.cycleTracker}</h2>
              <p className="text-xs text-gray-500">Every member receives the pooled payout exactly once per round.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((member, idx) => {
            const hasWon = member.hasReceivedPayout;
            const isCurrentCycle = !hasWon && member.eligibleForDraw;
            const isUser = member.userId === userProfile?.uid;

            return (
              <div
                key={member.userId}
                className={`p-4 border rounded-xl transition-all ${
                  hasWon
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : isCurrentCycle
                    ? 'border-2 border-[#7856FF] bg-[#7856FF]/5 shadow-sm'
                    : 'border-[#E6E1F5] bg-[#F8F7FC]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      hasWon ? 'bg-emerald-700 text-white' : isCurrentCycle ? 'bg-[#7856FF] text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {hasWon ? '✓' : `0${idx + 1}`}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        {member.displayName} {isUser && <span className="text-[#7856FF] font-bold">(You)</span>}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {hasWon
                          ? `Payout received in Cycle #${member.payoutCycle || idx + 1}`
                          : isCurrentCycle
                          ? 'Eligible for next live draw'
                          : 'Pending contribution payment'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                    hasWon
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isCurrentCycle
                      ? 'bg-[#7856FF] text-white border-[#7856FF]'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {hasWon ? t.turnReceived : isCurrentCycle ? t.turnCurrent : t.turnUpcoming}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member Roster & Contribution Compliance Table */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-2.5 h-2.5 bg-[#7856FF] rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1C1132]">{t.membersRoster}</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F8F7FC] text-gray-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Member Name</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Contribution Ledger</th>
                <th className="py-3 px-3">Draw Status</th>
                <th className="py-3 px-3">Turn Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m, idx) => (
                <tr key={m.userId} className="hover:bg-gray-50/50">
                  <td className="py-3 px-3 font-mono text-gray-400">{idx + 1}</td>
                  <td className="py-3 px-3 font-bold text-gray-900 flex items-center space-x-2">
                    <UserCheck className="w-4 h-4 text-gray-400" />
                    <span>{m.displayName}</span>
                  </td>
                  <td className="py-3 px-3 capitalize text-gray-600">{m.role}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-[#7856FF]">
                      {m.totalContributed ? m.totalContributed.toLocaleString() : 40000} ETB
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                      m.hasReceivedPayout
                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : m.eligibleForDraw
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {m.hasReceivedPayout ? 'Turn Completed' : m.eligibleForDraw ? 'Eligible ✓' : 'Pending Payment'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {m.hasReceivedPayout ? (
                      <span className="text-emerald-700 font-bold">Won Cycle #{m.payoutCycle || idx + 1}</span>
                    ) : (
                      <span className="text-gray-400">In Pool</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past Completed Draws & Verifiable Hash Proofs */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-[#7856FF] rounded-full" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1C1132]">{t.draws}</h2>
              <p className="text-xs text-gray-500">Every draw is permanently recorded and independently verifiable.</p>
            </div>
          </div>
        </div>

        {ekubDraws.length === 0 ? (
          <p className="text-xs text-gray-500 py-4">No completed draws for this Ekub yet.</p>
        ) : (
          <div className="space-y-3">
            {ekubDraws.map((d) => (
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-[#7856FF] text-white text-[10px] font-bold uppercase tracking-wider rounded-md">
                      Cycle #{d.cycleNumber}
                    </span>
                    <p className="text-xs font-bold text-gray-900">Winner: {d.winnerName}</p>
                    <span className="text-xs font-bold text-[#7856FF]">({d.payoutAmount.toLocaleString()} ETB)</span>
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 mt-1 truncate max-w-md">
                    Proof: {d.verificationHash || d.serverSeed?.substring(0, 32)}...
                  </p>
                </div>

                <button
                  onClick={() => onOpenVerifyDraw(d)}
                  className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-[#7856FF] border border-[#E6E1F5] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center space-x-1 self-start sm:self-auto shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
                  <span>{t.viewProof}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules and Terms Accordion */}
      {ekub.rules && (
        <div className="bg-[#F8F7FC] border border-[#E6E1F5] rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-[10px] font-bold text-[#7856FF] uppercase tracking-[0.2em] mb-2">
            <FileText className="w-4 h-4 text-[#7856FF]" />
            <span>{t.rulesAndTerms}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {ekub.rules}
          </p>
        </div>
      )}
    </div>
  );
};
