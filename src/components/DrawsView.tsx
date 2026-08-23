import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Coins, 
  CheckCircle2, 
  ArrowUpRight 
} from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';
import { Draw, Ekub } from '../types';

interface DrawsViewProps {
  draws: Draw[];
  ekubs: Ekub[];
  onOpenLiveDraw: (ekub?: Ekub) => void;
  onOpenVerifyDraw: (draw: Draw) => void;
}

export const DrawsView: React.FC<DrawsViewProps> = ({
  draws,
  ekubs,
  onOpenLiveDraw,
  onOpenVerifyDraw,
}) => {
  const { t, language } = useTranslation();

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="bg-[#1C1132] text-white p-6 sm:p-7 rounded-2xl border border-[#7856FF]/20 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-[#7856FF]" />
            <span>Provably Fair Draw Arena</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t.draws}
          </h1>
          <p className="text-xs text-white/80 mt-1 max-w-xl">
            Every draw turn is executed with server-side HMAC-SHA256 randomness, guaranteeing 100% fairness and zero administrative manipulation.
          </p>
        </div>

        <button
          onClick={() => onOpenLiveDraw(ekubs[0])}
          className="px-5 py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-all flex items-center space-x-2 self-start md:self-auto relative z-10 rounded-xl"
        >
          <Sparkles className="w-4 h-4" />
          <span>{t.joinDraw}</span>
        </button>
      </div>

      {/* Upcoming Scheduled Draws */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-[#7856FF] rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1C1132]">
            Upcoming Scheduled Draws
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ekubs.map((e) => (
            <div key={e.id} className="bg-white border border-[#E6E1F5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#7856FF]/40 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span className="px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Cycle #{e.currentCycle} Turn
                  </span>
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{e.frequency}</span>
                </div>

                <h3 className="text-base font-bold text-[#1C1132]">{e.name}</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Guaranteed Pot: <strong className="text-[#7856FF]">{e.payoutAmount.toLocaleString()} ETB</strong>
                </p>

                <div className="mt-3 p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl space-y-1 text-xs">
                  <div className="flex items-center space-x-1.5 text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-[#7856FF]" />
                    <span>Draw Date: <strong>Friday, 7:00 PM</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Eligible: <strong>{e.currentMemberCount} Members</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenLiveDraw(e)}
                className="w-full mt-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-1.5 transition-colors rounded-xl shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Enter Live Draw Arena</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Completed Draws Record & Cryptographic Audit */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-[#7856FF] rounded-full" />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#1C1132]">
            Historical Draws & Verifiable Mathematical Proofs
          </h2>
        </div>

        <div className="bg-white border border-[#E6E1F5] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6E1F5] bg-[#F8F7FC] text-gray-500 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Draw ID</th>
                  <th className="py-3 px-4">Ekub Circle</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4">Winner</th>
                  <th className="py-3 px-4">Payout</th>
                  <th className="py-3 px-4">Cryptographic Hash</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draws.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/60">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 font-bold">
                      {d.id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {d.ekubName}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      Cycle #{d.cycleNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      🎉 {d.winnerName}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#7856FF]">
                      {d.payoutAmount.toLocaleString()} ETB
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 truncate max-w-[160px]">
                      {d.verificationHash || d.serverSeed?.substring(0, 16)}...
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onOpenVerifyDraw(d)}
                        className="px-3 py-1.5 bg-[#F8F7FC] hover:bg-white text-[#7856FF] border border-[#E6E1F5] rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-1 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
                        <span>Verify Math</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
