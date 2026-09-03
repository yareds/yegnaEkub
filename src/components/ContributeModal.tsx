import React, { useState, useEffect } from 'react';
import { 
  X, 
  Receipt, 
  Building2, 
  Copy, 
  Check, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle2, 
  Coins,
  FileCheck
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, PreferredPaymentMethod, UserProfile } from '../types';
import { ETHIOPIAN_BANK_ACCOUNTS } from '../data/demoData';
import { submitContribution, isDemoModeActive } from '../firebase/ekubService';
import { storage } from '../firebase/config';

interface ContributeModalProps {
  ekub: Ekub;
  userProfile?: UserProfile | null;
  isDemoMode?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ContributeModal: React.FC<ContributeModalProps> = ({
  ekub,
  userProfile: propUserProfile,
  isDemoMode: propIsDemoMode,
  onClose,
  onSuccess,
}) => {
  const auth = useAuth();
  const userProfile = propUserProfile !== undefined ? propUserProfile : auth.userProfile;
  const isDemo = propIsDemoMode ?? isDemoModeActive();
  const { t, language } = useTranslation();

  const [cycleCount, setCycleCount] = useState<number>(1);
  const [selectedMethod, setSelectedMethod] = useState<PreferredPaymentMethod>('telebirr');
  const [txRef, setTxRef] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const totalAmount = ekub.contributionAmount * cycleCount;
  const currentBankInfo = ETHIOPIAN_BANK_ACCOUNTS.find(b => b.code === selectedMethod) || ETHIOPIAN_BANK_ACCOUNTS[0];

  const handleCopyAcc = () => {
    navigator.clipboard.writeText(currentBankInfo.accountNumber);
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError(language === 'am' ? 'እባክዎ ምስል ወይም PDF ፋይል ይምረጡ።' : 'Please choose an image or PDF file.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(language === 'am' ? 'ፋይሉ ከ5 ሜባ በላይ መሆን የለበትም።' : 'File must be under 5MB.');
      e.target.value = '';
      return;
    }

    setUploadingReceipt(true);

    // In demo mode or if storage is unconfigured / demo user, use local FileReader for instant receipt preview
    if (isDemo || !storage || userProfile?.uid?.startsWith('demo-')) {
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptUrl(reader.result as string);
        setReceiptFileName(file.name);
        setUploadingReceipt(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read receipt file.');
        setUploadingReceipt(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    if (!userProfile?.uid) {
      setUploadError('You must be signed in to upload a receipt.');
      setUploadingReceipt(false);
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `receipts/${ekub.id}/${userProfile.uid}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      setReceiptUrl(url);
      setReceiptFileName(file.name);
    } catch (err: any) {
      console.error('Receipt upload failed:', err);
      // Graceful fallback to Data URL if storage throws (e.g. offline or permission issue)
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptUrl(reader.result as string);
        setReceiptFileName(file.name);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txRef.trim()) {
      setErrorMessage('Please enter your bank or Telebirr transaction reference number.');
      return;
    }
    if (!receiptUrl) {
      setErrorMessage(language === 'am' ? 'እባክዎ የክፍያ ደረሰኝ ያያይዙ።' : 'Please upload your payment receipt.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await submitContribution({
        userId: userProfile?.uid || 'user-guest',
        userName: userProfile?.fullName || 'Yegna Member',
        userEmail: userProfile?.email || 'member@yegnaekub.et',
        ekubId: ekub.id,
        ekubName: ekub.name,
        cycleNumber: ekub.currentCycle,
        cycleCount,
        amountPerCycle: ekub.contributionAmount,
        paymentMethod: selectedMethod,
        receiptUrl,
        transactionReference: txRef,
      });

      setSubmittedSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit contribution.');
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
      <div className="bg-white max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-[#E6E1F5] rounded-2xl relative overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed & Prominent */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-[#7856FF] uppercase tracking-[0.2em]">
              <Receipt className="w-3.5 h-3.5" />
              <span>{ekub.name} (Cycle #{ekub.currentCycle})</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132] mt-0.5">
              {t.payContribution}
            </h2>
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

        {submittedSuccess ? (
          <div className="text-center py-10 px-6 space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-green-50 text-green-700 border border-green-200 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#1C1132]">
              {t.paymentSubmittedTitle}
            </h2>
            <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
              {t.paymentSubmittedDesc}
            </p>
            <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl max-w-xs mx-auto text-xs text-gray-700">
              <p>Amount: <strong>{totalAmount.toLocaleString()} ETB</strong></p>
              <p>Ref: <strong className="font-mono">{txRef}</strong></p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            
            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 space-y-5">
              
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Multiple-Cycle Selector (1, 2, or 3 Cycles) */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                  {t.selectCycleCount}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCycleCount(num)}
                      className={`py-2.5 px-3 text-xs font-bold border rounded-xl transition-all text-center ${
                        cycleCount === num
                          ? 'bg-[#7856FF] text-white border-[#7856FF] shadow-sm'
                          : 'bg-[#F8F7FC] text-gray-700 border-[#E6E1F5] hover:bg-gray-100'
                      }`}
                    >
                      <p className="uppercase tracking-wider">{num} {num === 1 ? 'Cycle' : 'Cycles'}</p>
                      <p className={`text-[10px] mt-0.5 ${cycleCount === num ? 'text-white/80' : 'text-gray-500'}`}>
                        {(ekub.contributionAmount * num).toLocaleString()} ETB
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Ethiopian Bank / Wallet */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ETHIOPIAN_BANK_ACCOUNTS.map((bank) => (
                    <button
                      key={bank.code}
                      type="button"
                      onClick={() => setSelectedMethod(bank.code as PreferredPaymentMethod)}
                      className={`p-2.5 border rounded-xl text-left text-xs transition-all ${
                        selectedMethod === bank.code
                          ? 'border-[#7856FF] bg-[#7856FF]/5 ring-1 ring-[#7856FF]'
                          : 'border-[#E6E1F5] bg-white hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-bold text-gray-900 truncate">{(bank.name || '').split('(')[0]}</p>
                      <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider">{(bank.code || '').toUpperCase()}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Transfer Instructions & Account Details */}
              <div className="bg-[#F8F7FC] p-4 border border-[#E6E1F5] rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">{currentBankInfo.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#7856FF] text-white rounded-md">
                    Target Account
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white p-3 border border-[#E6E1F5] rounded-lg">
                  <div>
                    <p className="text-[10px] text-gray-500">Account / Telebirr Number:</p>
                    <p className="font-mono font-bold text-sm text-[#7856FF]">{currentBankInfo.accountNumber}</p>
                    <p className="text-[10px] text-gray-500">Name: {currentBankInfo.accountName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAcc}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider flex items-center space-x-1 rounded-md transition-colors"
                  >
                    {copiedAcc ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                    <span>{copiedAcc ? t.copied : t.copy}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  {currentBankInfo.instructions}
                </p>
              </div>

              {/* Transaction Reference Input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.transactionReference} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder={t.transactionRefPlaceholder}
                  className="w-full px-3.5 py-2.5 border border-[#E6E1F5] rounded-xl text-xs focus:border-[#7856FF] outline-none font-mono"
                />
              </div>

              {/* Receipt Upload */}
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t.uploadReceipt} <span className="text-red-500">*</span>
                </label>

                {uploadError && (
                  <div className="flex items-start space-x-1.5 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded-lg px-2.5 py-2 mb-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 transition-colors bg-gray-50/50">
                  {uploadingReceipt ? (
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-600 py-2">
                      <div className="w-4 h-4 border-2 border-[#7856FF] border-t-transparent rounded-full animate-spin" />
                      <span>{language === 'am' ? 'በመስቀል ላይ...' : 'Uploading...'}</span>
                    </div>
                  ) : receiptFileName ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2.5 rounded-lg text-green-800 text-xs">
                      <div className="flex items-center space-x-2 truncate">
                        <FileCheck className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="truncate">{receiptFileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setReceiptFileName(''); setReceiptUrl(''); }}
                        className="text-xs text-red-600 hover:underline font-bold ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="text-xs text-gray-600 font-medium">{t.uploadHelp}</p>
                      <label className="inline-block text-xs font-bold text-[#7856FF] hover:underline cursor-pointer">
                        {language === 'am' ? 'ፋይል ይምረጡ' : 'Choose a file'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                          onChange={handleReceiptFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-gray-400">
                        {language === 'am' ? 'ምስል ወይም PDF፣ እስከ 5 ሜባ' : 'Image or PDF, up to 5MB'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer with Submit AND Cancel Buttons - Always in View */}
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
                disabled={submitting || uploadingReceipt || !receiptUrl}
                className="px-5 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 rounded-xl"
              >
                <Coins className="w-4 h-4 text-white" />
                <span>
                  {submitting ? t.loading : `${t.submitPayment} (${totalAmount.toLocaleString()} ETB)`}
                </span>
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};
