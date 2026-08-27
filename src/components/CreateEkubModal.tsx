import React, { useState } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  Users, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Building2,
  Lock
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, EkubFrequency, UserProfile } from '../types';
import { createEkub, getAllUsers } from '../firebase/ekubService';
import { ETHIOPIAN_BANK_ACCOUNTS } from '../data/demoData';

interface CreateEkubModalProps {
  onClose: () => void;
  onSuccess: (ekub: Ekub) => void;
}

export const CreateEkubModal: React.FC<CreateEkubModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetMembers, setTargetMembers] = useState<number>(10);
  const [frequency, setFrequency] = useState<EkubFrequency>('weekly');
  const [contributionAmount, setContributionAmount] = useState<number>(5000);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [selectedBanks, setSelectedBanks] = useState<string[]>(['cbe', 'telebirr']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Optional: assign the Group Admin right at creation time, when the
  // person who'll run this circle is already known (the common case --
  // "one person from the group contacts me" per the intended workflow).
  // Left blank, the Ekub is created unassigned and can be assigned later
  // from the Reassign Ekub Admin tab.
  const [assignAdminNow, setAssignAdminNow] = useState(false);
  const [selectedAdminUid, setSelectedAdminUid] = useState('');
  const [selectedAdminName, setSelectedAdminName] = useState('');
  const [platformUsers, setPlatformUsers] = useState<UserProfile[]>([]);
  const [loadingPlatformUsers, setLoadingPlatformUsers] = useState(false);

  React.useEffect(() => {
    if (assignAdminNow && platformUsers.length === 0 && !loadingPlatformUsers) {
      setLoadingPlatformUsers(true);
      getAllUsers().then(setPlatformUsers).finally(() => setLoadingPlatformUsers(false));
    }
  }, [assignAdminNow]);

  const payoutAmount = targetMembers * contributionAmount;

  const toggleBank = (code: string) => {
    if (selectedBanks.includes(code)) {
      if (selectedBanks.length > 1) {
        setSelectedBanks(selectedBanks.filter(b => b !== code));
      }
    } else {
      setSelectedBanks([...selectedBanks, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this Ekub.');
      return;
    }
    if (contributionAmount < 100) {
      setError('Minimum contribution is 100 ETB.');
      return;
    }
    if (assignAdminNow && !selectedAdminUid) {
      setError('Select who should administer this circle, or turn off "Assign Admin now" to leave it unassigned.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // The calling user (Super Admin) is the creator, but NOT the
      // initial admin of this specific Ekub -- creatorId is their uid.
      // If a real person was picked above, adminId/adminName reflect
      // them; otherwise the Ekub is created unassigned ('') and can be
      // assigned later via the Reassign Ekub Admin tab. The Super Admin
      // is never a member of any Ekub either way.
      const newEkub = await createEkub({
        name: name.trim(),
        description: description.trim() || 'Community RoSCA revolving savings circle.',
        adminId: assignAdminNow ? selectedAdminUid : '',
        adminName: assignAdminNow ? selectedAdminName : 'Unassigned',
        creatorId: userProfile?.uid || 'admin',
        totalMembers: targetMembers,
        contributionAmount,
        payoutAmount,
        currency: 'ETB',
        frequency,
        status: 'active',
        inviteCode: `EKUB-${Math.floor(1000 + Math.random() * 9000)}`,
        startDate,
        nextContributionDate: startDate,
        nextDrawDate: startDate,
        acceptedPaymentMethods: selectedBanks as any,
      });

      onSuccess(newEkub);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create Ekub circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E6E1F5] rounded-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 text-gray-900">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-1">
          <div className="w-10 h-10 bg-[#7856FF]/10 text-[#7856FF] rounded-xl flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1132]">
                {t.startEkub}
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-[#7856FF]/15 text-[#7856FF] border border-[#7856FF]/30">
                Super Admin Only
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {language === 'am' ? 'አዲስ የተረጋገጠ የዕቁብ ዙር ይጀምሩ' : 'Configure a new rotating savings circle'}
            </p>
          </div>
        </div>

        {error && (
          <div className="my-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          
          {/* Ekub Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'የዕቁቡ ስም' : 'Ekub Circle Name'} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bole Business Founders Weekly Pool"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'ገለጻ (አስፈላጊ ከሆነ)' : 'Purpose & Description (Optional)'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. For merchants investing in quarterly commercial inventory"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Assign Group Admin now (optional) */}
          <div className="p-3.5 bg-[#7856FF]/5 border border-[#7856FF]/20 rounded-xl space-y-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignAdminNow}
                onChange={(e) => { setAssignAdminNow(e.target.checked); setSelectedAdminUid(''); setSelectedAdminName(''); }}
                className="w-4 h-4 accent-[#7856FF]"
              />
              <span className="text-xs font-bold text-[#1C1132]">
                {language === 'am' ? 'የቡድን አስተዳዳሪውን አሁን ይመድቡ' : 'Assign the Group Admin now'}
              </span>
            </label>

            {assignAdminNow && (
              <>
                <select
                  required
                  value={selectedAdminUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setSelectedAdminUid(uid);
                    setSelectedAdminName(platformUsers.find(u => u.uid === uid)?.fullName || '');
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#7856FF]"
                >
                  <option value="">
                    {loadingPlatformUsers ? 'Loading people...' : platformUsers.length === 0 ? 'No invited people yet -- invite them first' : '-- Select the person who contacted you --'}
                  </option>
                  {platformUsers.map(u => (
                    <option key={u.uid} value={u.uid}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500">
                  {language === 'am'
                    ? 'ገና ካልተጋበዙ፣ ከመፍጠርዎ በፊት በመጀመሪያ ይጋብዙዋቸው (የአባላት ትር)።'
                    : 'Not seeing them? Invite them first from the Invite Member tab, then come back here.'}
                </p>
              </>
            )}
            {!assignAdminNow && (
              <p className="text-[10px] text-gray-500">
                {language === 'am'
                  ? 'ይህ ክበብ ሳይመደብ ይፈጠራል -- በኋላ ከ«Reassign Ekub Admin» ትር ማድረግ ይችላሉ።'
                  : 'This circle will be created unassigned -- you can assign its Admin later from the Reassign Ekub Admin tab.'}
              </p>
            )}
          </div>

          {/* Members & Contribution Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'የአባላት ብዛት' : 'Total Target Members'} *
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="3"
                  max="50"
                  required
                  value={targetMembers}
                  onChange={(e) => setTargetMembers(parseInt(e.target.value) || 0)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'የአንድ ዙር መዋጮ (ETB)' : 'Contribution / Member (ETB)'} *
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(parseInt(e.target.value) || 0)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Frequency & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'የመዋጮ ድግግሞሽ' : 'Cycle Frequency'} *
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as EkubFrequency)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white"
              >
                <option value="daily">{t.daily}</option>
                <option value="weekly">{t.weekly}</option>
                <option value="biweekly">{t.biweekly}</option>
                <option value="monthly">{t.monthly}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                {language === 'am' ? 'የመጀመሪያ ዙር መክፈያ ቀን' : 'First Contribution Date'} *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7856FF] focus:bg-white"
              />
            </div>
          </div>

          {/* Supported Ethiopian Payment Channels */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              {language === 'am' ? 'የሚደገፉ የኢትዮጵያ የክፍያ መንገዶች' : 'Accepted Payment Gateways'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ETHIOPIAN_BANK_ACCOUNTS.map((bank) => {
                const selected = selectedBanks.includes(bank.code);
                return (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => toggleBank(bank.code)}
                    className={`p-2.5 text-left border rounded-lg transition-all ${
                      selected
                        ? 'bg-[#7856FF]/10 border-[#7856FF] text-[#1C1132]'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs font-bold">{bank.name.split('(')[0]}</p>
                    <p className="text-[10px] text-gray-400">{bank.code.toUpperCase()}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Financial Calculation Summary Preview */}
          <div className="bg-[#F8F7FC] p-4 border border-[#E6E1F5] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold">
                {language === 'am' ? 'የእያንዳንዱ አባል ድረሻ ድምር' : 'Guaranteed Pool Payout'}
              </p>
              <p className="text-2xl font-bold text-[#1C1132] mt-0.5">
                {payoutAmount.toLocaleString()} <span className="text-sm font-semibold text-gray-600">ETB</span>
              </p>
            </div>
            <div className="text-xs text-gray-600 text-right space-y-0.5">
              <p>Duration: <strong>{targetMembers} {frequency} cycles</strong></p>
              <p>Platform Fee: <strong className="text-green-600">0.00 ETB (100% Free)</strong></p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center space-x-2 rounded-lg"
            >
              {loading ? (
                <span>Creating Ekub...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'am' ? 'ዕቁቡን ጀምር' : 'Create & Activate Circle'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
