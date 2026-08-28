import React, { useState, useEffect } from 'react';
import { 
  X, 
  Banknote, 
  Building2, 
  CheckCircle2, 
  UploadCloud, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  FileCheck,
  Coins
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Payout } from '../types';
import { submitPayoutAccountDetails } from '../firebase/ekubService';

interface PayoutWorkflowModalProps {
  payout: Payout;
  onClose: () => void;
  onSuccess: () => void;
}

export const PayoutWorkflowModal: React.FC<PayoutWorkflowModalProps> = ({
  payout,
  onClose,
  onSuccess,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const [bankName, setBankName] = useState(payout.payoutAccountDetails?.bankName || 'Commercial Bank of Ethiopia (CBE)');
  const [accountHolder, setAccountHolder] = useState(payout.payoutAccountDetails?.accountHolderName || userProfile?.fullName || '');
  const [accountNumber, setAccountNumber] = useState(payout.payoutAccountDetails?.accountNumber || '');
  const [phoneOrAmole, setPhoneOrAmole] = useState(payout.payoutAccountDetails?.phoneOrAmole || userProfile?.phoneNumber || '');
  const [idFileName, setIdFileName] = useState(payout.submittedDocuments?.[0]?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
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
    if (!accountNumber.trim()) {
      setError('Please provide a valid account number or Telebirr registered phone.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitPayoutAccountDetails(
        payout.ekubId,
        payout.id,
        {
          bankName,
          accountHolderName: accountHolder,
          accountNumber,
          phoneOrAmole,
        },
        idFileName || 'National_Kebele_ID_Verified.pdf'
      );

      setSuccessNotice(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to submit payout details.');
      setSubmitting(false);
    }
  };

  const handleSimulateIdAttach = () => {
    setIdFileName(`Ethiopian_ID_${userProfile?.fullName?.replace(/\s+/g, '_') || 'Member'}.pdf`);
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
      <div className="bg-white max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-[#E6E1F5] relative text-gray-900 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7856FF] text-white flex items-center justify-center font-bold">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132]">
                {t.payoutCenter}
              </h2>
              <p className="text-[11px] text-gray-500 font-mono">
                {payout.ekubName} • Cycle #{payout.cycleNumber}
              </p>
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
        {successNotice ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#1C1132]">
              Payout Details Received!
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
              Our compliance team is verifying your account with the bank. Once cleared, your {payout.amount.toLocaleString()} ETB wire transfer will be released.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#7856FF] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#6340FF] transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 space-y-4 text-xs">
              
              {/* Pool Payout Amount Badge */}
              <div className="p-4 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                    Eligible Disbursable Amount
                  </p>
                  <p className="text-2xl font-bold text-[#7856FF] mt-0.5 font-mono">
                    {payout.amount.toLocaleString()} <span className="text-xs font-sans text-gray-600">ETB</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider rounded-lg border border-amber-200">
                  {(payout.status || '').replace(/_/g, ' ')}
                </span>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Bank Selector */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.bankName}
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E6E1F5] rounded-xl text-xs bg-white focus:border-[#7856FF] outline-none"
                >
                  <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                  <option value="Telebirr Direct Mobile Wallet">Telebirr Direct Mobile Wallet</option>
                  <option value="Dashen Bank (Amole)">Dashen Bank (Amole)</option>
                  <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Cooperative Bank of Oromia (Coop)">Cooperative Bank of Oromia (Coop)</option>
                </select>
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.accountHolder}
                </label>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Full Name as appears on bank account"
                  className="w-full px-3.5 py-2.5 border border-[#E6E1F5] rounded-xl text-xs focus:border-[#7856FF] outline-none"
                />
              </div>

              {/* Account / Wallet Number */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.accountNumber} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1000284719284 or 0911..."
                  className="w-full px-3.5 py-2.5 border border-[#E6E1F5] rounded-xl text-xs font-mono focus:border-[#7856FF] outline-none"
                />
              </div>

              {/* ID Document Attachment */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.uploadIdDoc}
                </label>
                
                <div className="border border-dashed border-gray-300 p-3.5 bg-gray-50 rounded-xl text-center">
                  {idFileName ? (
                    <div className="flex items-center justify-between text-green-800 text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <FileCheck className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="truncate">{idFileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIdFileName('')}
                        className="text-xs text-red-600 font-bold ml-2 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-5 h-5 text-gray-400 mx-auto" />
                      <button
                        type="button"
                        onClick={handleSimulateIdAttach}
                        className="text-xs font-bold text-[#7856FF] hover:underline"
                      >
                        Attach Ethiopian Kebele ID / Passport (Verified Sample)
                      </button>
                    </div>
                  )}
                </div>
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
                <Banknote className="w-4 h-4 text-white" />
                <span>{submitting ? t.loading : t.submitPayoutClaim}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
