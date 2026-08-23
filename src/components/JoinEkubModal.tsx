import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Coins, 
  Users 
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub } from '../types';
import { joinEkubWithInviteCode } from '../firebase/ekubService';

interface JoinEkubModalProps {
  onClose: () => void;
  onSuccess: (ekub: Ekub) => void;
}

export const JoinEkubModal: React.FC<JoinEkubModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAuth();
  const { t, language } = useTranslation();

  const [inviteCode, setInviteCode] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError('Please enter a 6-character Ekub invite code.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const ekub = await joinEkubWithInviteCode(
        inviteCode.trim(),
        userProfile?.uid || 'user-guest',
        userProfile?.fullName || 'Yegna Member',
        userProfile?.email || 'member@yegnaekub.et'
      );

      onSuccess(ekub);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite code.');
      setSubmitting(false);
    }
  };

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
        
        {/* Header - Fixed */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7856FF] text-white flex items-center justify-center font-bold">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132]">
                {t.joinEkub}
              </h2>
              <p className="text-[11px] text-gray-500">Enter private circle invite code</p>
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
                {t.inviteCode} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. BOLE24, ADDIS1, MEK009"
                className="w-full p-3 border border-[#E6E1F5] rounded-xl font-mono text-center text-base tracking-[0.2em] uppercase outline-none focus:border-[#7856FF]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Try sample codes: <strong className="font-mono text-gray-800">BOLE24</strong>, <strong className="font-mono text-gray-800">ADDIS1</strong>, or <strong className="font-mono text-gray-800">MEK009</strong>
              </p>
            </div>

          </div>

          {/* Action Footer */}
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
              <span>{submitting ? 'Verifying...' : 'Join Circle'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

