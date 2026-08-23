import React, { useState } from 'react';
import { 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  FileText,
  Clock
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { SupportTicket, Ekub } from '../types';
import { createSupportTicket } from '../firebase/ekubService';

interface DisputeCenterProps {
  ekubs: Ekub[];
  tickets: SupportTicket[];
  onRefreshTickets: () => void;
}

export const DisputeCenter: React.FC<DisputeCenterProps> = ({
  ekubs,
  tickets,
  onRefreshTickets,
}) => {
  const { userProfile } = useAuth();
  const { t, language } = useTranslation();

  const [category, setCategory] = useState<'payment' | 'eligibility' | 'draw' | 'payout' | 'account' | 'other'>('payment');
  const [selectedEkubId, setSelectedEkubId] = useState((ekubs || [])[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState('');

  const userTickets = (tickets || []).filter(t => t.userId === userProfile?.uid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Please provide a subject and detailed description.');
      return;
    }

    setSubmitting(true);
    setError('');

    const targetEkub = (ekubs || []).find(e => e.id === selectedEkubId);

    try {
      await createSupportTicket({
        userId: userProfile?.uid || 'user-guest',
        userName: userProfile?.fullName || 'Yegna Member',
        userEmail: userProfile?.email || 'member@yegnaekub.et',
        ekubId: targetEkub?.id,
        ekubName: targetEkub?.name,
        category,
        subject,
        description,
        priority: 'medium',
      });

      setSubmittedSuccess(true);
      setSubject('');
      setDescription('');
      onRefreshTickets();
      setTimeout(() => setSubmittedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket.');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 sm:p-8 shadow-sm">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#7856FF]/10 text-[#7856FF] text-xs font-semibold uppercase tracking-wider mb-2">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Member Dispute & Support Center</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t.disputes}
        </h1>
        <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
          Need assistance with payment verification, turn eligibility status, or bank wire details? File a dispute or inquiry directly with our compliance resolution team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Ticket Submission Form */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Submit New Dispute / Inquiry
          </h2>

          {submittedSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Ticket Submitted Successfully!</p>
                <p className="text-[11px] mt-0.5">An admin compliance officer has been notified.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Related Ekub
              </label>
              <select
                value={selectedEkubId}
                onChange={(e) => setSelectedEkubId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-[#7856FF]"
              >
                {ekubs.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-gray-300 bg-white outline-none focus:ring-2 focus:ring-[#7856FF]"
              >
                <option value="payment">Payment Verification Delay / Missing Slip</option>
                <option value="eligibility">Draw Turn Eligibility Question</option>
                <option value="payout">Winner Payout Disbursement Inquiry</option>
                <option value="account">Bank Details / Account Correction</option>
                <option value="other">General Feedback / Inquiries</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Telebirr receipt submitted 2 hours ago still pending"
                className="w-full p-2.5 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#7856FF]"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">
                Detailed Description & Bank Reference
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include transaction references, amount, date, and any relevant details..."
                className="w-full p-2.5 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-[#7856FF]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs shadow-md transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              <span>{submitting ? 'Submitting...' : 'Submit Dispute Ticket'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Ticket History */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Your Support Tickets ({userTickets.length})
          </h2>

          {userTickets.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No tickets submitted</p>
              <p className="text-gray-400 mt-0.5">Your submitted inquiries will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userTickets.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-[#F8F7FC] border border-[#E6E1F5] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{t.subject}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-gray-600">{t.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                    <span>Ticket #{t.ticketId} • {t.category.toUpperCase()}</span>
                    <span>{t.createdAt.split('T')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
