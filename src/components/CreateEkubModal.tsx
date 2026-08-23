import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Coins, 
  Calendar, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  Lock,
  FileText,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, EkubFrequency } from '../types';
import { createEkub } from '../firebase/ekubService';

interface CreateEkubModalProps {
  onClose: () => void;
  onSuccess: (newEkub: Ekub) => void;
}

export const CreateEkubModal: React.FC<CreateEkubModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<EkubFrequency>('weekly');
  const [contributionAmount, setContributionAmount] = useState<number>(5000);
  const [memberLimit, setMemberLimit] = useState<number>(10);
  const [rules, setRules] = useState('All members must transfer contributions within 24h of cycle opening. Payout is drawn using provably fair HMAC-SHA256 randomness.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const payoutAmount = contributionAmount * memberLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Admin access required. Only verified administrators can start new Ekub circles.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide an Ekub circle name.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const code = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase() + Math.floor(10 + Math.random() * 90);

      const created = await createEkub({
        name,
        description,
        status: 'active',
        contributionAmount,
        currency: 'ETB',
        frequency,
        memberLimit,
        payoutAmount,
        totalCycles: memberLimit,
        adminId: userProfile?.uid || 'user-admin',
        adminName: userProfile?.fullName || 'Super Admin',
        organizerId: userProfile?.uid || 'user-admin',
        organizerName: userProfile?.fullName || 'Super Admin',
        startDate: today,
        nextContributionDate: nextWeek.split('T')[0],
        nextDrawDate: nextWeek,
        rules,
        inviteCode: code,
        isPrivate: false,
      });

      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create Ekub.');
      setSubmitting(false);
    }
  };

  // If user is NOT an admin, display access-denied state with quick switch to Admin persona
  if (!isAdmin) {
    return (
      <div 
        className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white max-w-md w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-[#E6E1F5] relative text-gray-900 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-[#F8F7FC] shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#1C1132]">
                  {language === 'am' ? 'የአድሚን ፈቃድ ያስፈልጋል' : 'Admin Access Required'}
                </h2>
                <p className="text-[11px] text-gray-500">Restricted Ekub Circle Initialization</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-[#E6E1F5]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 text-xs">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950 text-xs uppercase tracking-wider mb-1">
                    {language === 'am' ? 'የአስተዳዳሪ ብቻ ፈቃድ' : 'Admin-Only Privilege'}
                  </p>
                  <p className="text-xs text-amber-900">
                    {language === 'am'
                      ? 'አዲስ የዕቁብ ዙር ማስጀመር የተፈቀደው ለተረጋገጡ የሲስተም አድሚኖች ብቻ ነው። አባላት ያሉትን ክፍት ዕቁቦች መቀላቀል ወይም መዋጮ መክፈል ይችላሉ።'
                      : 'Starting a new Ekub savings circle is strictly restricted to platform administrators and authorized organizers. Verified members can explore and join existing active circles.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Current Active Account</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{userProfile?.fullName || 'Active User'}</p>
                  <p className="text-[11px] text-gray-500">{userProfile?.email || 'Unauthenticated'}</p>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700 rounded-lg">
                  {userProfile?.role === 'member' ? 'Member' : userProfile?.role || 'Guest'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#F8F7FC] border-t border-[#E6E1F5] flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-white rounded-xl border border-gray-200 transition-all uppercase tracking-wider"
            >
              {t.cancel || 'Close'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-[#E6E1F5] relative text-gray-900 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7856FF] text-white flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132]">
                  {language === 'am' ? 'አዲስ የዕቁብ ዙር ይጀምሩ' : 'Start New Ekub Circle'}
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#7856FF]/10 text-[#7856FF] border border-[#7856FF]/30 rounded-full">
                  Admin Verified
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Configure contribution amount, cycle frequency, and rules.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-[#F8F7FC] rounded-xl transition-colors border border-transparent hover:border-[#E6E1F5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 space-y-4 text-xs">
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                Ekub Circle Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bole Entrepreneurs Weekly Savings"
                className="w-full p-2.5 border border-[#E6E1F5] rounded-xl outline-none focus:border-[#7856FF]"
              />
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                Description & Purpose
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. For shop inventory purchase and seasonal stock"
                className="w-full p-2.5 border border-[#E6E1F5] rounded-xl outline-none focus:border-[#7856FF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                  Contribution (ETB)
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#E6E1F5] rounded-xl outline-none focus:border-[#7856FF] font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                  Total Members (Rounds)
                </label>
                <select
                  value={memberLimit}
                  onChange={(e) => setMemberLimit(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#E6E1F5] rounded-xl bg-white outline-none focus:border-[#7856FF]"
                >
                  <option value={5}>5 Members (5 Cycles)</option>
                  <option value={10}>10 Members (10 Cycles)</option>
                  <option value={15}>15 Members (15 Cycles)</option>
                  <option value={20}>20 Members (20 Cycles)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                Frequency
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['weekly', 'biweekly', 'monthly'] as EkubFrequency[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      frequency === f
                        ? 'bg-[#7856FF] text-white border-[#7856FF] shadow-xs'
                        : 'bg-[#F8F7FC] text-gray-700 border-[#E6E1F5] hover:bg-gray-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculated Pool Pot Card */}
            <div className="p-3.5 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Calculated Pot per Winner</p>
                <p className="text-xl font-bold text-[#7856FF] font-mono mt-0.5">
                  {payoutAmount.toLocaleString()} ETB
                </p>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                ✓ Locked Once Active
              </span>
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                Custom Rules & Guidelines
              </label>
              <textarea
                rows={2}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                className="w-full p-2.5 border border-[#E6E1F5] rounded-xl outline-none focus:border-[#7856FF]"
              />
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#F8F7FC] border-t border-[#E6E1F5] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-white rounded-xl border border-gray-200 transition-all uppercase tracking-wider"
            >
              {t.cancel || 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 rounded-xl"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>{submitting ? 'Creating...' : 'Initialize Ekub Circle'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

