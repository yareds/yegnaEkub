import React, { useEffect } from 'react';
import { X, ShieldCheck, Scale, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';

interface LegalModalProps {
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ onClose }) => {
  const { t, language } = useTranslation();

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

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white max-w-2xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-[#E6E1F5] relative text-gray-900 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7856FF] text-white flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132]">
                {t.legalDisclaimer}
              </h2>
              <p className="text-[11px] text-gray-500">Ethiopian RoSCA Framework & Digital Governance</p>
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

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 space-y-3.5 text-xs text-gray-600 leading-relaxed">
          <div className="p-4 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <h3 className="font-bold text-[#7856FF] uppercase tracking-wider text-[11px] mb-1 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#7856FF]" />
              <span>1. Traditional Ethiopian Ekub Nature</span>
            </h3>
            <p>
              YegnaEkub is a digital facilitation and record-keeping software for traditional Ethiopian Ekubs (Rotating Savings and Credit Associations - RoSCAs). YegnaEkub is not a bank, microfinance institution, or deposit-taking entity. Funds are pooled and transferred peer-to-peer or through licensed Ethiopian payment operators (Telebirr, CBE, Dashen, Abyssinia).
            </p>
          </div>

          <div className="p-4 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <h3 className="font-bold text-[#7856FF] uppercase tracking-wider text-[11px] mb-1 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-[#7856FF]" />
              <span>2. Provably Fair Randomness Guarantee</span>
            </h3>
            <p>
              All draw lotteries are executed using server-side HMAC-SHA256 cryptography with pre-committed seeds. No organizer or system administrator has the capability to influence, alter, or predict the winning member. Every member receives the full pot exactly once per completed round.
            </p>
          </div>

          <div className="p-4 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl">
            <h3 className="font-bold text-[#7856FF] uppercase tracking-wider text-[11px] mb-1 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#7856FF]" />
              <span>3. Member Obligations & Good Standing</span>
            </h3>
            <p>
              Members commit to contributing their agreed cycle amount promptly. Failure to remit contributions excludes members from participating in subsequent live draws and may result in forfeiture of organizer trust status according to group bylaws.
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#F8F7FC] border-t border-[#E6E1F5] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-white rounded-xl border border-gray-200 transition-all uppercase tracking-wider"
          >
            {t.cancel || 'Close'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-md active:scale-98"
          >
            I Understand & Agree
          </button>
        </div>

      </div>
    </div>
  );
};

