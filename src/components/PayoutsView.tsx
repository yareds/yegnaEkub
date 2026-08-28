import React from 'react';
import { 
  Banknote, 
  Coins, 
  CheckCircle2, 
  Clock, 
  FileCheck, 
  AlertCircle, 
  ArrowUpRight,
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Payout } from '../types';

interface PayoutsViewProps {
  payouts: Payout[];
  onOpenClaim: (payout: Payout) => void;
}

export const PayoutsView: React.FC<PayoutsViewProps> = ({
  payouts,
  onOpenClaim,
}) => {
  const { userProfile } = useAuth();
  const { t, language } = useTranslation();

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-xs">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/10 text-[#7856FF] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
          <Banknote className="w-3.5 h-3.5" />
          <span>Disbursement & Claim Center</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C1132]">
          {t.payouts}
        </h1>
        <p className="text-xs text-gray-500 mt-1 max-w-xl">
          Track winner payout claims, submit Ethiopian bank account details, and review disbursed wire transfers.
        </p>
      </div>

      {/* Payout Cards List */}
      <div className="space-y-4">
        {payouts.map((p) => {
          const isWinner = p.winnerId === userProfile?.uid;
          const canClaim = isWinner && (p.status === 'documents_required' || p.status === 'pending');

          return (
            <div
              key={p.id}
              className={`p-6 rounded-2xl border transition-all ${
                canClaim 
                  ? 'bg-[#7856FF]/5 border-[#7856FF]/40 ring-1 ring-[#7856FF]/40' 
                  : 'bg-white border-[#E6E1F5] shadow-xs'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-base text-gray-900">
                      🎉 {p.winnerName} {isWinner && <span className="text-[#7856FF] text-xs font-bold uppercase tracking-wider">(You)</span>}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full ${
                      p.status === 'paid'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : p.status === 'approved'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {(p.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600">
                    Ekub: <strong>{p.ekubName}</strong> • Cycle #{p.cycleNumber}
                  </p>

                  <p className="text-xl font-bold text-[#7856FF]">
                    {p.amount.toLocaleString()} <span className="text-xs text-gray-500 font-sans">ETB</span>
                  </p>

                  {p.payoutAccountDetails && (
                    <div className="text-xs text-gray-600 bg-[#F8F7FC] p-3 border border-[#E6E1F5] rounded-xl mt-2 space-y-0.5">
                      <p>Bank: <strong>{p.payoutAccountDetails.bankName}</strong></p>
                      <p>Account: <strong className="font-mono">{p.payoutAccountDetails.accountNumber}</strong> ({p.payoutAccountDetails.accountHolderName})</p>
                      {p.paymentReference && (
                        <p className="text-green-700 font-mono font-semibold">
                          Settlement Ref: {p.paymentReference}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 self-start md:self-center">
                  {canClaim && (
                    <button
                      onClick={() => onOpenClaim(p)}
                      className="px-5 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-all flex items-center space-x-1.5 rounded-xl"
                    >
                      <Coins className="w-4 h-4 text-white" />
                      <span>{t.claimPayout}</span>
                    </button>
                  )}

                  {p.status === 'paid' && (
                    <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-800 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>Disbursed via Bank Wire</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
