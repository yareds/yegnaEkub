import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { YegnaEkubLogo } from './YegnaEkubLogo';

interface SignInModalProps {
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ onClose }) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useTranslation();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAmharic = language === 'am';

  const friendlyError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    const msg = (err as Error)?.message || '';
    if (code.includes('auth/email-already-in-use')) {
      return isAmharic ? 'ይህ ኢሜይል ቀደም ሲል ተመዝግቧል። እባክዎ ይግቡ።' : 'This email is already registered. Please sign in.';
    }
    if (code.includes('auth/weak-password')) {
      return isAmharic ? 'የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት።' : 'Password must be at least 6 characters.';
    }
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
      return isAmharic ? 'የተሳሳተ ኢሜይል ወይም የይለፍ ቃል።' : 'Incorrect email or password.';
    }
    if (code.includes('auth/popup-closed-by-user')) {
      return isAmharic ? 'የመግቢያ መስኮቱ ተዘግቷል።' : 'Sign in popup was closed.';
    }
    if (msg) return msg;
    return isAmharic ? 'የመግቢያ ሙከራ አልተሳካም። እባክዎ እንደገና ይሞክሩ።' : 'Something went wrong. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, fullName);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
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
            {mode === 'signin' 
              ? (isAmharic ? 'ወደ መለያዎ ይግቡ' : 'Sign in to your account')
              : (isAmharic ? 'አዲስ መለያ ይፍጠሩ' : 'Create an Account')}
          </h2>
          <p className="mt-1 text-[11px] text-gray-500 max-w-xs">
            {isAmharic
              ? 'የኢትዮጵያ ዲጂታል የዕቁብና የፋይናንስ ማህበረሰብ መድረክ'
              : 'Ethiopia\u2019s premier digital RoSCA & financial savings community.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="px-8 pt-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin' ? 'bg-white text-[#1C1132] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {isAmharic ? 'ግባ' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' ? 'bg-white text-[#1C1132] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {isAmharic ? 'ተመዝገብ' : 'Create Account'}
            </button>
          </div>
        </div>

        <div className="px-8 pb-8 pt-4 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="w-full py-2.5 px-4 border border-gray-300 rounded-lg flex items-center justify-center space-x-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isAmharic ? 'በ Google ይቀጥሉ' : 'Continue with Google'}</span>
          </button>

          <div className="flex items-center space-x-2 my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider">
              {isAmharic ? 'ወይም' : 'or'}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isAmharic ? 'ሙሉ ስም' : 'Full Name'}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF]"
                  required={mode === 'signup'}
                />
              </div>
            )}

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
                : mode === 'signin'
                  ? (isAmharic ? 'ግባ' : 'Sign In')
                  : (isAmharic ? 'መለያ ፍጠር' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
