import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Coins, 
  Users, 
  Calendar, 
  ShieldCheck, 
  Plus, 
  KeyRound, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub } from '../types';

interface DiscoverViewProps {
  ekubs: Ekub[];
  onSelectEkub: (ekub: Ekub) => void;
  onOpenCreate: () => void;
  onOpenJoin: () => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  ekubs,
  onSelectEkub,
  onOpenCreate,
  onOpenJoin,
}) => {
  const { isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'weekly' | 'biweekly' | 'monthly'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = (ekubs || []).filter((e) => {
    if (frequencyFilter !== 'all' && e.frequency !== frequencyFilter) return false;
    if (searchTerm) {
      const adminDisplay = e.adminName || e.organizerName || '';
      const match = 
        e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adminDisplay.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="bg-[#1C1132] text-white p-6 sm:p-7 rounded-2xl border border-[#7856FF]/20 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
            <Coins className="w-3.5 h-3.5 text-[#7856FF]" />
            <span>Curated RoSCA Circles</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t.exploreEkubs}
          </h1>
          <p className="text-xs text-white/80 mt-1 max-w-xl">
            Join vetted Ethiopian digital Ekub savings circles or initialize a private circle for your trusted circle of friends, merchants, or colleagues.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 relative z-10">
          <button
            onClick={onOpenJoin}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-[#C4B5FD] border border-white/20 font-bold text-xs uppercase tracking-widest transition-all flex items-center space-x-1.5 rounded-xl"
          >
            <KeyRound className="w-4 h-4 text-[#7856FF]" />
            <span>{t.joinEkub}</span>
          </button>

          {isAdmin && (
            <button
              onClick={onOpenCreate}
              className="px-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-all flex items-center space-x-1.5 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              <span>{t.startEkub}</span>
              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded text-white font-bold uppercase">Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'weekly', 'biweekly', 'monthly'] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => setFrequencyFilter(freq)}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border rounded-xl ${
                frequencyFilter === freq
                  ? 'bg-[#7856FF] text-white border-[#7856FF] shadow-sm'
                  : 'bg-white text-gray-600 border-[#E6E1F5] hover:bg-gray-50'
              }`}
            >
              {freq}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by circle name or organizer..."
            className="w-full pl-9 pr-3.5 py-2 border border-[#E6E1F5] rounded-xl text-xs bg-white outline-none focus:border-[#7856FF]"
          />
        </div>
      </div>

      {/* Ekub Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((e) => (
          <div
            key={e.id}
            className="bg-white border border-[#E6E1F5] rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-[#7856FF]/50 hover:shadow-md transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200 rounded-full">
                  {e.status}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  {e.frequency}
                </span>
              </div>

              <h2 className="text-base font-bold text-[#1C1132]">{e.name}</h2>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                {e.description}
              </p>

              <div className="mt-4 p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t.amountDue}:</span>
                  <span className="font-bold text-gray-900">{e.contributionAmount.toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t.currentPot}:</span>
                  <span className="font-bold text-[#7856FF]">{e.payoutAmount.toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t.members}:</span>
                  <span className="font-bold text-gray-800">{e.currentMemberCount} / {e.memberLimit}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Admin: <strong className="text-gray-800">{(e.adminName || e.organizerName || 'Admin').split(' ')[0]}</strong>
              </span>

              <button
                onClick={() => onSelectEkub(e)}
                className="px-3.5 py-1.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest flex items-center space-x-1 transition-colors rounded-xl shadow-xs"
              >
                <span>{t.viewDetails}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
