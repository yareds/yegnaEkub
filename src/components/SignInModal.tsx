import React, { useState } from 'react';
import { X, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { YegnaEkubLogo } from './YegnaEkubLogo';

interface SignInModalProps {
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ onClose }) => {
  const { signInWithEmail } = useAuth();
  const { language } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAmharic = language === 'am';

  const friendlyError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    const msg = (err as Error)?.message || '';
    if (msg.includes('not been invited') || (err as { name?: string })?.name === 'NotInvitedError') {
      return isAmharic 
        ? 'ይህ መለያ ወደ የኛዕቁብ እስካሁን አልተጋበዘም። እባክዎ የዕቁብ አስተዳዳሪዎን ወይም ዋና አስተዳዳሪውን ያነጋግሩ።' 
        : 'This account has not been invited to YegnaEkub yet. Please contact your Ekub Admin or the Super Admin for an invitation.';
    }
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
      return isAmharic ? 'የተሳሳተ ኢሜይል ወይም የይለፍ ቃል።' : 'Incorrect email or password.';
    }
    if (msg) return msg;
    return isAmharic ? 'የመግቢያ ሙከራ አልተሳካም። እባክዎ እንደገና ይሞክሩ።' : 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E6E1F5] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-8 pb-2 flex flex-col items-center text-center">
          <YegnaEkubLogo variant="full" size="sm" theme="light" showSubtext={false} />
          <h2 className="mt-4 text-lg font-bold text-[#1C1132]">
            {isAmharic ? 'ወደ መለያዎ ይግቡ' : 'Sign in to your account'}
          </h2>
          <p className="mt-1 text-[11px] text-gray-500 max-w-xs">
            {isAmharic
              ? 'የኢትዮጵያ ዲጂታል የዕቁብና የፋይናንስ ማህበረሰብ መድረክ'
              : 'Ethiopia\u2019s premier digital RoSCA & financial savings community.'}
          </p>
        </div>

        <div className="px-8 pb-8 pt-4 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAmharic ? 'ኢሜይል' : 'Email'}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF]"
                required
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isAmharic ? 'የይለፍ ቃል' : 'Password'}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF]"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting
                ? (isAmharic ? 'እባክዎ ይጠብቁ...' : 'Please wait...')
                : (isAmharic ? 'ግባ' : 'Sign In')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
