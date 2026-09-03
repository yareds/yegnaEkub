import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Plus, 
  Coins, 
  ExternalLink,
  Eye,
  X
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Contribution, Ekub, UserProfile } from '../types';

interface ContributionsViewProps {
  contributions: Contribution[];
  ekubs: Ekub[];
  onOpenContribute: (ekub?: Ekub) => void;
  userProfile?: UserProfile | null;
}

export const ContributionsView: React.FC<ContributionsViewProps> = ({
  contributions,
  ekubs,
  onOpenContribute,
  userProfile: propUserProfile,
}) => {
  const auth = useAuth();
  const userProfile = propUserProfile !== undefined ? propUserProfile : auth.userProfile;
  const { t, language } = useTranslation();

  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'mine'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectSlip, setInspectSlip] = useState<Contribution | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectSlip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = (contributions || []).filter((c) => {
    if (filter === 'verified' && c.status !== 'verified') return false;
    if (filter === 'pending' && c.status !== 'pending') return false;
    if (filter === 'mine' && c.userId !== userProfile?.uid) return false;
    if (searchTerm) {
      const match = 
        c.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ekubName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.transactionReference?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/10 text-[#7856FF] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
            <Receipt className="w-3.5 h-3.5" />
            <span>Verified Savings Ledger</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1132]">
            {t.contributions}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Transparent and immutable record of all Telebirr, CBE, and bank transfer contributions.
          </p>
        </div>

        <button
          onClick={() => onOpenContribute(ekubs[0])}
          className="px-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-all flex items-center space-x-1.5 self-start sm:self-auto rounded-xl"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>{t.payContribution}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'mine', 'verified', 'pending'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border rounded-xl ${
                filter === mode
                  ? 'bg-[#7856FF] text-white border-[#7856FF] shadow-xs'
                  : 'bg-white text-gray-600 border-[#E6E1F5] hover:bg-gray-50'
              }`}
            >
              {mode === 'mine' ? 'My Payments' : mode}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search member, ref, or Ekub..."
            className="w-full pl-9 pr-3.5 py-2 border border-[#E6E1F5] rounded-xl text-xs bg-white outline-none focus:border-[#7856FF]"
          />
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white border border-[#E6E1F5] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E6E1F5] bg-[#F8F7FC] text-gray-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Ekub Circle</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method & Ref</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No contributions match your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60">
                    <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                      {c.submittedAt ? c.submittedAt.split('T')[0] : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {c.userName}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {c.ekubName} (Cycle #{c.cycleNumber})
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#7856FF]">
                      {c.amount.toLocaleString()} ETB
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-gray-800 uppercase text-[10px]">{c.paymentMethod}</p>
                      <p className="font-mono text-[10px] text-gray-400">{c.transactionReference}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full ${
                        c.status === 'verified'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : c.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {c.status === 'verified' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        <span>{c.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setInspectSlip(c)}
                        className="p-1.5 border border-[#E6E1F5] rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                        title="View slip"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Preview Modal */}
      {inspectSlip && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectSlip(null);
            }
          }}
        >
          <div className="bg-white max-w-sm w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto p-6 border border-[#E6E1F5] rounded-2xl shadow-2xl relative text-gray-900 my-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setInspectSlip(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#7856FF] mb-1">Receipt Attachment</h3>
            <p className="text-xs text-gray-500 mb-3">{inspectSlip.userName} • {inspectSlip.amount.toLocaleString()} ETB</p>
            <div className="overflow-hidden border border-gray-200 rounded-xl bg-gray-50 max-h-72 flex items-center justify-center mb-3">
              <img
                src={inspectSlip.receiptUrl}
                alt="Receipt"
                className="w-full object-contain max-h-72"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-0.5 mb-4 font-mono">
              <p>Ref: <strong>{inspectSlip.transactionReference}</strong></p>
              <p>Status: <strong className="capitalize">{inspectSlip.status}</strong></p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInspectSlip(null)}
                className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
