import React, { useState } from 'react';
import { X, User as UserIcon, Phone, Globe, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { PreferredPaymentMethod } from '../types';

interface EditProfileModalProps {
  onClose: () => void;
}

const PAYMENT_METHODS: { value: PreferredPaymentMethod; label: string }[] = [
  { value: 'telebirr', label: 'Telebirr' },
  { value: 'cbe', label: 'CBE' },
  { value: 'cbe_birr', label: 'CBE Birr' },
  { value: 'dashen', label: 'Dashen Bank' },
  { value: 'abyssinia', label: 'Bank of Abyssinia' },
];

// Lets a signed-in user fix their own name/phone/language/payment-method
// preference without needing Firebase Console access. Only touches the
// exact fields the Firestore rules already allow a user to self-update
// (fullName, phoneNumber, preferredLanguage, preferredPaymentMethod) --
// role can never be changed here, by rule, regardless of what's submitted.
export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const { userProfile, updateUserProfile } = useAuth();
  const { language: appLanguage } = useTranslation();
  const isAmharic = appLanguage === 'am';

  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'am'>(userProfile?.preferredLanguage || 'en');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PreferredPaymentMethod | ''>(userProfile?.preferredPaymentMethod || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError(isAmharic ? 'እባክዎ ሙሉ ስምዎን ያስገቡ።' : 'Please enter your full name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateUserProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        preferredLanguage,
        preferredPaymentMethod: preferredPaymentMethod || undefined,
      });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err?.message || (isAmharic ? 'መገለጫውን ማዘመን አልተሳካም።' : 'Failed to update your profile.'));
    } finally {
      setSaving(false);
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

        <div className="px-8 pt-8 pb-2">
          <h2 className="text-lg font-bold text-[#1C1132]">
            {isAmharic ? 'መገለጫ ያርትዑ' : 'Edit Profile'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {userProfile?.email}
          </p>
        </div>

        <div className="px-8 pb-8 pt-4 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start space-x-2 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{isAmharic ? 'መገለጫ ተዘምኗል!' : 'Profile updated!'}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                {isAmharic ? 'ሙሉ ስም' : 'Full Name'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                {isAmharic ? 'ስልክ ቁጥር' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+251 9XX XXX XXX"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                {isAmharic ? 'ቋንቋ' : 'Language'}
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as 'en' | 'am')}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF] bg-white appearance-none"
                >
                  <option value="en">English</option>
                  <option value="am">አማርኛ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                {isAmharic ? 'የተመረጠ የክፍያ ዘዴ' : 'Preferred Payment Method'}
              </label>
              <div className="relative">
                <Wallet className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={preferredPaymentMethod}
                  onChange={(e) => setPreferredPaymentMethod(e.target.value as PreferredPaymentMethod)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7856FF]/40 focus:border-[#7856FF] bg-white appearance-none"
                >
                  <option value="">{isAmharic ? '-- ይምረጡ --' : '-- Select --'}</option>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving
                ? (isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...')
                : (isAmharic ? 'አስቀምጥ' : 'Save Changes')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
