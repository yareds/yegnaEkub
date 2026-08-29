import React, { useState } from 'react';
import { 
  Users, 
  Receipt, 
  Sparkles, 
  Banknote, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  UserCheck, 
  FileText, 
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Lock,
  Mail,
  Copy,
  Check,
  Send,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { 
  Ekub, 
  EkubMember, 
  Contribution, 
  Draw, 
  Payout, 
  SupportTicket, 
  AuditLog,
  UserProfile
} from '../types';
import { 
  verifyPayment, 
  rejectPayment, 
  approvePayout, 
  disbursePayout, 
  getEkubMembers,
  assignEkubAdmin,
  approveMembershipRequest,
  removeEkubMember,
  inviteMember,
  joinEkub,
  getAuditLogs,
  getAllUsers,
  seedSampleData
} from '../firebase/ekubService';
import { ETHIOPIAN_BANK_ACCOUNTS } from '../data/demoData';

interface AdminDashboardProps {
  ekubs: Ekub[];
  contributions: Contribution[];
  draws: Draw[];
  payouts: Payout[];
  supportTickets: SupportTicket[];
  onRefreshData: () => void;
  onOpenLiveDraw: (ekub: Ekub) => void;
  onOpenVerifyDraw: (draw: Draw) => void;
  onOpenCreateEkub: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  ekubs,
  contributions,
  draws,
  payouts,
  supportTickets,
  onRefreshData,
  onOpenLiveDraw,
  onOpenVerifyDraw,
  onOpenCreateEkub,
}) => {
  const { userProfile, isAdmin, isSuperAdmin } = useAuth();
  const { t, language } = useTranslation();

  // Ekub Admins must only ever see/select circles they actually administer
  // -- Super Admin sees everything, matching the platform-wide oversight
  // role. This does NOT affect the "Reassign Ekub Admin" tab's own circle
  // selector further below, which is correctly Super-Admin-only already
  // and needs the full list to reassign any circle.
  const accessibleEkubs = isSuperAdmin ? ekubs : ekubs.filter(e => e.adminId === userProfile?.uid);

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'pending-payments' | 'payout-approvals' | 'members' | 'reassign' | 'invite' | 'circles' | 'audit'>('pending-payments');

  // Selected Circle for Member Roster / Operations
  const [selectedEkubId, setSelectedEkubId] = useState<string>(accessibleEkubs[0]?.id || '');
  const [members, setMembers] = useState<EkubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invite member form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ resetLink: string; email: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Reassignment form state
  const [reassignAdminUid, setReassignAdminUid] = useState('');
  const [reassignAdminName, setReassignAdminName] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [platformUsers, setPlatformUsers] = useState<UserProfile[]>([]);
  const [loadingPlatformUsers, setLoadingPlatformUsers] = useState(false);
  const [manualUidEntry, setManualUidEntry] = useState(false);

  // Action status / processing
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  // Modals & confirmation dialogs (safe for sandboxed iframes)
  const [showSeedConfirmModal, setShowSeedConfirmModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<EkubMember | null>(null);

  // Disburse modal / inline input
  const [disburseTarget, setDisburseTarget] = useState<Payout | null>(null);
  const [paymentRefInput, setPaymentRefInput] = useState('');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const selectedEkub = accessibleEkubs.find(e => e.id === selectedEkubId) || accessibleEkubs[0];

  // Ekub Admin check: Is the current user the designated admin of the selected Ekub?
  const isAssignedEkubAdmin = selectedEkub?.adminId === userProfile?.uid;
  // Approving membership requests and removing members are Ekub-Admin-only
  // operations on the backend now (the Super Admin's role is create/assign/
  // invite plus read-only oversight, not day-to-day circle management) --
  // this must match that restriction, not grant Super Admin a UI path to an
  // action the Cloud Function will reject.
  const canManageCurrentEkub = isAssignedEkubAdmin;

  // Pending Payments / Payout Approvals are hidden entirely for Super
  // Admin (that's each circle's own Ekub Admin's job) -- redirect off
  // those tabs if landed on by default, since 'pending-payments' is this
  // component's initial tab state for everyone.
  React.useEffect(() => {
    if (isSuperAdmin && (activeTab === 'pending-payments' || activeTab === 'payout-approvals')) {
      setActiveTab('members');
    }
  }, [isSuperAdmin, activeTab]);

  // Load members whenever selected Ekub changes
  React.useEffect(() => {
    if (selectedEkubId) {
      setLoadingMembers(true);
      getEkubMembers(selectedEkubId)
        .then((m) => setMembers(Array.isArray(m) ? m : []))
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false));
    }
  }, [selectedEkubId]);

  // Load the platform user list when the Reassign tab opens, so the Super
  // Admin can pick a real person instead of pasting a raw Firebase UID.
  React.useEffect(() => {
    if (activeTab === 'reassign' && platformUsers.length === 0 && !loadingPlatformUsers) {
      setLoadingPlatformUsers(true);
      getAllUsers()
        .then((users) => setPlatformUsers(users))
        .finally(() => setLoadingPlatformUsers(false));
    }
  }, [activeTab]);

  // Load audit logs when switching to audit tab
  React.useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      getAuditLogs(50, isSuperAdmin ? undefined : selectedEkubId)
        .then((logs) => setAuditLogs(Array.isArray(logs) ? logs : []))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab, isSuperAdmin, selectedEkubId]);

  // Handle Verify Contribution
  const handleVerifyContribution = async (contrib: Contribution) => {
    setProcessingId(contrib.id);
    setActionError('');
    setActionSuccess('');
    try {
      await verifyPayment(contrib.ekubId, contrib.id, userProfile?.uid, userProfile?.fullName);
      setActionSuccess(`Payment of ${contrib.amount.toLocaleString()} ETB verified successfully.`);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to verify payment.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject Contribution
  const handleRejectContribution = async (contrib: Contribution) => {
    const reason = prompt('Please enter a rejection reason (e.g. Invalid CBE receipt ref):') || 'Receipt unverified';
    setProcessingId(contrib.id);
    setActionError('');
    setActionSuccess('');
    try {
      await rejectPayment(contrib.ekubId, contrib.id, userProfile?.uid, userProfile?.fullName, reason);
      setActionSuccess('Contribution marked as rejected.');
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject payment.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Approve Payout
  const handleApprovePayout = async (payout: Payout) => {
    setProcessingId(payout.id);
    setActionError('');
    setActionSuccess('');
    try {
      await approvePayout(payout.ekubId, payout.id);
      setActionSuccess(`Payout #${payout.id.slice(0, 8)} approved. Ready for fund disbursement.`);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve payout.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Disburse Payout
  const handleConfirmDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseTarget || !paymentRefInput.trim()) return;

    setProcessingId(disburseTarget.id);
    setActionError('');
    setActionSuccess('');
    try {
      await disbursePayout(disburseTarget.ekubId, disburseTarget.id, paymentRefInput.trim());
      setActionSuccess(`Disbursement of ${disburseTarget.amount.toLocaleString()} ETB recorded successfully.`);
      setDisburseTarget(null);
      setPaymentRefInput('');
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to record disbursement.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reassign Ekub Admin (Super Admin only)
  const handleReassignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEkubId || !reassignAdminUid.trim()) return;

    setReassignSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      await assignEkubAdmin(selectedEkubId, reassignAdminUid.trim(), reassignAdminName.trim() || undefined);
      setActionSuccess(`Ekub Admin successfully reassigned.`);
      setReassignAdminUid('');
      setReassignAdminName('');
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reassign admin.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Handle Approve Membership Request
  const handleApproveMember = async (userId: string) => {
    if (!selectedEkubId) return;
    setProcessingId(userId);
    setActionError('');
    setActionSuccess('');
    try {
      await approveMembershipRequest(selectedEkubId, userId);
      setActionSuccess('Membership request approved.');
      const m = await getEkubMembers(selectedEkubId);
      setMembers(Array.isArray(m) ? m : []);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve member.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Remove Member Confirmation & Execution
  const handleConfirmRemoveMember = async () => {
    if (!selectedEkubId || !memberToRemove) return;
    const userId = memberToRemove.userId;
    setProcessingId(userId);
    setActionError('');
    setActionSuccess('');
    try {
      await removeEkubMember(selectedEkubId, userId);
      setActionSuccess(`Member ${memberToRemove.displayName} removed from Ekub.`);
      setMemberToRemove(null);
      const m = await getEkubMembers(selectedEkubId);
      setMembers(Array.isArray(m) ? m : []);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member.');
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Seed Sample Data (Super Admin)
  const [seedingData, setSeedingData] = useState(false);

  const handleExecuteSeedSampleData = async () => {
    setSeedingData(true);
    setActionError('');
    setActionSuccess('');
    try {
      const circles = await seedSampleData();
      setShowSeedConfirmModal(false);
      setActionSuccess(
        `Successfully generated ${circles.length} sample circles: ` +
        circles.map(c => `${c.name} (${c.memberCount} members, Admin: ${c.adminEmail})`).join('; ')
      );
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to generate sample data.');
    } finally {
      setSeedingData(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteFullName.trim()) return;

    setInviteSubmitting(true);
    setActionError('');
    setActionSuccess('');
    setInviteResult(null);
    try {
      const res = await inviteMember(inviteEmail.trim(), inviteFullName.trim(), invitePhone.trim() || undefined);

      let successMessage = res.alreadyExisted
        ? `Account for ${inviteFullName.trim()} (${inviteEmail.trim()}) was found. A fresh login/onboarding link has been generated below.`
        : `Invitation created for ${inviteFullName.trim()} (${inviteEmail.trim()}). Share the onboarding link below.`;

      if (!isSuperAdmin && selectedEkub?.id) {
        try {
          await joinEkub(selectedEkub.id, {
            userId: res.uid,
            displayName: inviteFullName.trim(),
            phoneNumber: invitePhone.trim() || undefined,
          });
          successMessage = res.alreadyExisted
            ? `Existing member ${inviteFullName.trim()} (${inviteEmail.trim()}) was added to ${selectedEkub.name}. Share the login link below.`
            : `Invitation created for ${inviteFullName.trim()} (${inviteEmail.trim()}) and added to ${selectedEkub.name}. Share the onboarding link below.`;
        } catch (addErr: any) {
          const errMsg = addErr.message || '';
          if (errMsg.includes('already a member') || errMsg.includes('already-exists')) {
            successMessage = `${inviteFullName.trim()} (${inviteEmail.trim()}) is already a member of ${selectedEkub.name}. Share the login link below.`;
          } else {
            successMessage = `Account processed for ${inviteFullName.trim()} (${inviteEmail.trim()}), but adding them to ${selectedEkub.name} failed: ${errMsg}. You can add them manually from Circle Roster.`;
          }
        }
      }

      setInviteResult({ resetLink: res.resetLink, email: inviteEmail.trim() });
      setActionSuccess(successMessage);
      setInviteEmail('');
      setInviteFullName('');
      setInvitePhone('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to invite member.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteResult?.resetLink) {
      navigator.clipboard.writeText(inviteResult.resetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const pendingContributions = (contributions || []).filter(c => c.status === 'pending');
  const actionablePayouts = (payouts || []).filter(p => p.status === 'documents_required' || p.status === 'under_review' || p.status === 'approved' || p.status === 'pending');

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header Banner */}
      <div className="bg-[#1C1132] text-white p-6 sm:p-7 border-b border-[#7856FF]/30 shadow-md rounded-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
              <span>{isSuperAdmin ? 'SUPER ADMIN WORKSPACE' : 'EKUB ADMIN WORKSPACE'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {isSuperAdmin
                ? (language === 'am' ? 'የመድረክ አስተዳደር ማዕከል' : 'Platform Governance Center')
                : (language === 'am' ? 'የክበብ አስተዳደር ማዕከል' : 'Circle Operations Center')}
            </h1>
            <p className="text-xs text-white/70 mt-1 max-w-xl">
              {isSuperAdmin
                ? (language === 'am'
                    ? 'ዕቁቦችን ይፍጠሩ፣ የክበብ አስተዳዳሪዎችን ይመድቡ ወይም ይቀይሩ፣ ሰዎችን ይጋብዙ፣ እና በመላው መድረክ ላይ ያለውን እንቅስቃሴ ይከታተሉ።'
                    : 'Create Ekubs, assign or reassign Circle Admins, invite people to the platform, and monitor activity platform-wide. Day-to-day circle operations -- verifying receipts, approving payouts, running draws -- belong to each circle\u2019s assigned Admin.')
                : (language === 'am'
                    ? 'የባንክ ደረሰኞችን ያረጋግጡ፣ አባላትን ያቀናብሩ እና የዕቁብ ድረሻ ክፍያዎችን ያጽድቁ።'
                    : 'Audit bank receipts, approve verified draw winners, and administer your circle\u2019s member roster.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {isSuperAdmin && (
              <button
                onClick={onOpenCreateEkub}
                className="px-4 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all flex items-center space-x-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                <span>{t.startEkub}</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                onClick={() => setShowSeedConfirmModal(true)}
                disabled={seedingData}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs uppercase tracking-widest transition-all flex items-center space-x-1.5 rounded-lg disabled:opacity-50"
                title="Creates 3 sample circles with real Admin accounts, for testing"
              >
                <Sparkles className="w-4 h-4 text-[#C4B5FD]" />
                <span>{seedingData ? 'Generating...' : 'Generate Sample Data'}</span>
              </button>
            )}

            <button
              onClick={onRefreshData}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-widest border border-white/20 transition-all flex items-center space-x-1.5 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C4B5FD]" />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-green-600 font-bold hover:underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-red-600 font-bold hover:underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Secondary Sub-Tabs */}
      <div className="flex flex-wrap border-b border-[#E6E1F5] gap-2 pb-px text-xs font-bold uppercase tracking-wider">
        {/* Verifying contributions and approving payouts are exclusively
            each circle's own Ekub Admin's job -- the Super Admin's role is
            create/assign/invite plus platform-wide oversight, not
            day-to-day circle operations. Hidden entirely for Super Admin,
            not just action-restricted. */}
        {!isSuperAdmin && (
          <button
            onClick={() => setActiveTab('pending-payments')}
            className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'pending-payments'
                ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Pending Payments</span>
            {pendingContributions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#7856FF] text-white text-[10px] rounded-full">
                {pendingContributions.length}
              </span>
            )}
          </button>
        )}

        {!isSuperAdmin && (
          <button
            onClick={() => setActiveTab('payout-approvals')}
            className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'payout-approvals'
                ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Payout Approvals</span>
            {actionablePayouts.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full">
                {actionablePayouts.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'members'
              ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Circle Roster & Approvals</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('reassign')}
            className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'reassign'
                ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Reassign Ekub Admin</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('invite')}
          className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'invite'
              ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>

        <button
          onClick={() => setActiveTab('circles')}
          className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'circles'
              ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
              : 'text-gray-500 hover:text-gray-900'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Ekub Operations</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Platform Audit Log</span>
          </button>
        )}
      </div>

      {/* TAB 1: PENDING PAYMENTS AUDIT */}
      {!isSuperAdmin && activeTab === 'pending-payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
              Submitted Contribution Receipts Awaiting Admin Audit ({pendingContributions.length})
            </h2>
          </div>

          {pendingContributions.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E6E1F5] rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900">All Contributions Verified</h3>
              <p className="text-xs text-gray-500 mt-1">There are no pending member payments requiring verification.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingContributions.map((c) => (
                <div key={c.id} className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7856FF] bg-[#7856FF]/10 px-2 py-0.5 rounded">
                        {c.ekubName}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm mt-1.5">{c.userName}</h4>
                      <p className="text-xs text-gray-500">{c.userEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#1C1132]">{c.amount.toLocaleString()} ETB</p>
                      <span className="text-[10px] uppercase font-bold text-amber-600">Cycle #{c.cycleNumber}</span>
                    </div>
                  </div>

                  {/* Payment Details Pill */}
                  <div className="bg-[#F8F7FC] p-3 rounded-lg border border-[#E6E1F5] text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gateway:</span>
                      <span className="font-bold text-gray-800 uppercase">{c.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reference:</span>
                      <span className="font-mono font-bold text-[#7856FF]">{c.transactionReference}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Submitted:</span>
                      <span className="text-gray-700">{new Date(c.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Receipt Preview */}
                  {c.receiptUrl && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-1">Attached Bank Slip:</span>
                      <a 
                        href={c.receiptUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center space-x-1 text-xs text-[#7856FF] hover:underline font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect Full Image Proof</span>
                      </a>
                    </div>
                  )}

                  {/* Action Buttons -- verifying a contribution is
                      exclusively that Ekub's assigned Admin's job now, not
                      the Super Admin's. Checking per-item (not just the
                      globally-selected Ekub filter) since "All Circles" can
                      show contributions from several Ekubs at once. */}
                  {c.ekubId && ekubs.find(e => e.id === c.ekubId)?.adminId === userProfile?.uid ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleVerifyContribution(c)}
                        disabled={processingId === c.id}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center space-x-1.5 rounded-lg disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{processingId === c.id ? 'Verifying...' : 'Approve & Confirm'}</span>
                      </button>

                      <button
                        onClick={() => handleRejectContribution(c)}
                        disabled={processingId === c.id}
                        className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 rounded-lg disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-[11px] text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                      <span>View only -- only this circle's assigned Ekub Admin can verify or reject.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYOUT APPROVALS & DISBURSEMENT */}
      {!isSuperAdmin && activeTab === 'payout-approvals' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
            Guaranteed Draw Winners Awaiting Payout Processing ({actionablePayouts.length})
          </h2>

          {actionablePayouts.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E6E1F5] rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900">All Payouts Disbursed</h3>
              <p className="text-xs text-gray-500 mt-1">There are no pending winner payouts requiring review or disbursement.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actionablePayouts.map((p) => (
                <div key={p.id} className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7856FF] bg-[#7856FF]/10 px-2 py-0.5 rounded">
                        {p.ekubName} • Cycle #{p.cycleNumber}
                      </span>
                      <h4 className="font-bold text-gray-900 text-base mt-1.5">{p.winnerName}</h4>
                      <p className="text-xs text-gray-500">Won on {new Date(p.drawDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#7856FF]">{p.amount.toLocaleString()} ETB</p>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {(p.status || '').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Bank Account Verification Details */}
                  {p.payoutAccountDetails ? (
                    <div className="bg-[#F8F7FC] p-3 rounded-lg border border-[#E6E1F5] text-xs space-y-1">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Submitted Payout Destination:</p>
                      <p className="font-bold text-gray-900">{p.payoutAccountDetails.bankName.toUpperCase()}</p>
                      <p className="text-gray-700">Account: <strong className="font-mono">{p.payoutAccountDetails.accountNumber}</strong></p>
                      <p className="text-gray-700">Beneficiary: <strong>{p.payoutAccountDetails.accountHolderName}</strong></p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                      Winner has not submitted their verified bank account details yet.
                    </div>
                  )}

                  {/* Multi-step Approval Actions -- approving/disbursing a
                      payout is exclusively that Ekub's assigned Admin's job
                      now, not the Super Admin's. */}
                  {p.ekubId && ekubs.find(e => e.id === p.ekubId)?.adminId === userProfile?.uid ? (
                    <div className="pt-2 border-t border-gray-100 flex gap-2">
                      {p.status === 'under_review' || p.status === 'documents_required' || p.status === 'pending' ? (
                        <button
                          onClick={() => handleApprovePayout(p)}
                          disabled={processingId === p.id}
                          className="flex-1 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors rounded-lg disabled:opacity-50"
                        >
                          {processingId === p.id ? 'Approving...' : 'Approve Bank Details'}
                        </button>
                      ) : p.status === 'approved' ? (
                        <button
                          onClick={() => setDisburseTarget(p)}
                          className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors rounded-lg flex items-center justify-center space-x-1.5"
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Record Bank Transfer (Disburse)</span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 font-medium">Payout Processed</span>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-[11px] text-gray-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                      <span>View only -- only this circle's assigned Ekub Admin can process this payout.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CIRCLE ROSTER & MEMBERSHIP APPROVALS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                Circle Members & Join Requests ({members.length})
              </h2>
              <p className="text-xs text-gray-500">
                Review pending requests and manage active draw-eligible participants.
              </p>
            </div>

            {/* Ekub Selector -- scoped to circles this viewer actually
                administers; Super Admin sees all of them. */}
            <select
              value={selectedEkubId}
              onChange={(e) => setSelectedEkubId(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#7856FF]"
            >
              {accessibleEkubs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({(e.status || 'ACTIVE').toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {loadingMembers ? (
            <div className="p-12 text-center bg-white border border-[#E6E1F5] rounded-xl">
              <div className="w-8 h-8 border-2 border-[#7856FF] border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Loading Circle Roster...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E6E1F5] rounded-xl">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900">No Members Found</h3>
              <p className="text-xs text-gray-500 mt-1">This Ekub currently has no registered members or pending requests.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E1F5] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F7FC] border-b border-[#E6E1F5] text-gray-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Draw Eligibility</th>
                      <th className="py-3 px-4">Total Contributed</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map((m) => (
                      <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900">{m.displayName}</p>
                          <p className="text-[10px] text-gray-500">{m.email || m.userId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.role === 'admin' ? 'bg-[#7856FF]/15 text-[#7856FF] border border-[#7856FF]/30' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {m.hasReceivedPayout ? (
                            <span className="text-gray-400 font-medium">Won (Ineligible)</span>
                          ) : m.eligibleForDraw ? (
                            <span className="text-green-600 font-bold">Eligible</span>
                          ) : (
                            <span className="text-amber-600">Pending Payment</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">
                          {(m.totalContributed || 0).toLocaleString()} ETB
                        </td>
                        <td className="py-3 px-4 text-right">
                          {m.status === 'pending' && canManageCurrentEkub ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveMember(m.userId)}
                                disabled={processingId === m.userId}
                                className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white font-bold rounded text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setMemberToRemove(m)}
                                disabled={processingId === m.userId}
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold rounded text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : canManageCurrentEkub && m.role !== 'admin' ? (
                            <button
                              onClick={() => setMemberToRemove(m)}
                              disabled={processingId === m.userId}
                              className="text-red-500 hover:text-red-700 text-[11px] font-bold uppercase tracking-wider hover:underline"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[10px]">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REASSIGN EKUB ADMIN (Super Admin only) */}
      {activeTab === 'reassign' && isSuperAdmin && (
        <div className="max-w-2xl bg-white p-6 border border-[#E6E1F5] rounded-xl shadow-sm space-y-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
              Reassign Ekub Admin Authority
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Super Admin privilege: transfer operational circle control, live draw execution rights, and member verification authority to a new admin.
            </p>
          </div>

          <form onSubmit={handleReassignAdmin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Target Ekub Circle *
              </label>
              <select
                value={selectedEkubId}
                onChange={(e) => setSelectedEkubId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#7856FF]"
              >
                {ekubs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} (Current Admin: {e.adminName || e.adminId || 'None'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  New Admin *
                </label>
                <button
                  type="button"
                  onClick={() => { setManualUidEntry(!manualUidEntry); setReassignAdminUid(''); setReassignAdminName(''); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#7856FF] hover:underline"
                >
                  {manualUidEntry ? 'Pick from list instead' : 'Enter UID manually instead'}
                </button>
              </div>

              {manualUidEntry ? (
                <input
                  type="text"
                  required
                  value={reassignAdminUid}
                  onChange={(e) => setReassignAdminUid(e.target.value)}
                  placeholder="e.g. Firebase Auth UID of the new Ekub Admin"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#7856FF]"
                />
              ) : (
                <select
                  required
                  value={reassignAdminUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setReassignAdminUid(uid);
                    const picked = platformUsers.find(u => u.uid === uid);
                    setReassignAdminName(picked?.fullName || '');
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#7856FF]"
                >
                  <option value="">
                    {loadingPlatformUsers ? 'Loading people...' : platformUsers.length === 0 ? 'No invited people yet -- invite someone first' : '-- Select a person --'}
                  </option>
                  {platformUsers.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-gray-500 mt-1">
                {manualUidEntry
                  ? 'Paste the UID shown after inviting someone (Invite Member tab).'
                  : 'Only people who\u2019ve been invited to the platform appear here. Not seeing them? Invite them first.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                New Admin Display Name (Optional)
              </label>
              <input
                type="text"
                value={reassignAdminName}
                onChange={(e) => setReassignAdminName(e.target.value)}
                placeholder="e.g. Abebe Bikila"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#7856FF]"
                readOnly={!manualUidEntry && !!reassignAdminUid}
              />
            </div>

            <button
              type="submit"
              disabled={reassignSubmitting}
              className="w-full py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-colors rounded-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{reassignSubmitting ? 'Transferring Authority...' : 'Execute Admin Authority Transfer'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 5: INVITE MEMBER */}
      {activeTab === 'invite' && (
        <div className="max-w-2xl bg-white p-6 border border-[#E6E1F5] rounded-xl shadow-sm space-y-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
              Invite a New Member
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Public self-registration is closed. Creating an invitation provisions a verified account and generates a direct password setup link.
            </p>
          </div>

          <form onSubmit={handleInviteMember} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Member Email Address *
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. member@domain.com"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#7856FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="e.g. Sara Tesfaye"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#7856FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="e.g. +251 91 234 5678"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#7856FF]"
              />
            </div>

            <button
              type="submit"
              disabled={inviteSubmitting}
              className="w-full py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-colors rounded-lg disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{inviteSubmitting ? 'Creating Invitation...' : 'Generate Member Invitation'}</span>
            </button>
          </form>

          {inviteResult && (
            <div className="p-4 bg-[#F8F7FC] border border-[#7856FF]/30 rounded-xl space-y-3">
              <p className="text-xs font-bold text-gray-900">
                Share this onboarding link with <span className="text-[#7856FF]">{inviteResult.email}</span>:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteResult.resetLink}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center space-x-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                The member can open this link to set their initial password and sign in directly.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: EKUB OPERATIONS */}
      {activeTab === 'circles' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
            Ekub Circles Operational Status ({accessibleEkubs.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleEkubs.map((e) => (
              <div key={e.id} className="bg-white p-5 border border-[#E6E1F5] rounded-xl shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900 text-base">{e.name}</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{e.description}</p>
                </div>

                <div className="bg-[#F8F7FC] p-3 rounded-lg border border-[#E6E1F5] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ekub Admin:</span>
                    <span className="font-bold text-gray-800">{e.adminName || 'Assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cycle Progress:</span>
                    <span className="font-bold text-[#7856FF]">Cycle #{e.currentCycle} of {e.totalMembers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pool Payout:</span>
                    <span className="font-bold text-gray-900 font-mono">{e.payoutAmount.toLocaleString()} ETB</span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenLiveDraw(e)}
                  className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center space-x-1.5 rounded-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  {/* The modal this opens already enforces who can actually
                      start the draw (only that Ekub's assigned Admin) --
                      this label just avoids implying the Super Admin can
                      launch it themselves. */}
                  <span>{e.adminId === userProfile?.uid ? 'Launch Live Draw' : 'View Live Draw'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: PLATFORM AUDIT LOG (Super Admin only) */}
      {activeTab === 'audit' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                Immutable Platform Governance Audit Trail
              </h2>
              <p className="text-xs text-gray-500">
                Every administrative verification, draw outcome, payout, and assignment is permanently logged server-side.
              </p>
            </div>
            <button
              onClick={() => {
                setLoadingAudit(true);
                getAuditLogs(50, isSuperAdmin ? undefined : selectedEkubId)
                  .then((logs) => setAuditLogs(Array.isArray(logs) ? logs : []))
                  .catch(() => setAuditLogs([]))
                  .finally(() => setLoadingAudit(false));
              }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingAudit ? (
            <div className="p-12 text-center bg-white border border-[#E6E1F5] rounded-xl">
              <div className="w-8 h-8 border-2 border-[#7856FF] border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Loading Audit Trail...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E6E1F5] rounded-xl">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900">No Audit Logs</h3>
              <p className="text-xs text-gray-500 mt-1">Platform actions will appear here once executed.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E1F5] rounded-xl overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                        {((log.action || (log as any).actionType || 'LOG_ENTRY') as string).replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-gray-600">{log.details || log.reason || 'Activity recorded.'}</p>
                    <div className="flex gap-4 text-[10px] text-gray-400 pt-1">
                      <span>Actor: <strong className="text-gray-600">{log.actorName || (log as any).performedByName || log.actorId || (log as any).performedBy || 'System'}</strong></span>
                      {(log.entityId || (log as any).ekubId || (log as any).targetEkubId) && (
                        <span>Target: <strong className="text-gray-600">{log.entityId || (log as any).ekubId || (log as any).targetEkubId}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DISBURSEMENT CONFIRMATION MODAL */}
      {disburseTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-[#E6E1F5] shadow-2xl space-y-4 text-gray-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-[#1C1132]">Record Payout Disbursement</h3>
                <p className="text-xs text-gray-500 mt-0.5">Disbursing {disburseTarget.amount.toLocaleString()} ETB to {disburseTarget.winnerName}</p>
              </div>
              <button onClick={() => setDisburseTarget(null)} className="p-1 text-gray-400 hover:text-gray-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDisbursement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Bank Transfer / Telebirr Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  value={paymentRefInput}
                  onChange={(e) => setPaymentRefInput(e.target.value)}
                  placeholder="e.g. FT24268XXXXX or CBE Ref #"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#7856FF]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisburseTarget(null)}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === disburseTarget.id || !paymentRefInput.trim()}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {processingId === disburseTarget.id ? 'Recording...' : 'Confirm Disbursed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAMPLE DATA GENERATION MODAL (SUPER ADMIN ONLY) */}
      {showSeedConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 sm:p-7 rounded-2xl border border-[#E6E1F5] shadow-2xl space-y-5 text-gray-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#7856FF]/10 text-[#7856FF] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1C1132]">Generate Sample Circles &amp; Admins</h3>
                  <p className="text-xs text-gray-500">Platform Demonstration &amp; Testing Suite</p>
                </div>
              </div>
              <button 
                onClick={() => !seedingData && setShowSeedConfirmModal(false)} 
                disabled={seedingData}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This will provision <strong>3 realistic Ethiopian Ekub circles</strong> with complete member rosters and dedicated Circle Administrator accounts:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-bold text-gray-900">
                  <span>1. Bole Daily Savers</span>
                  <span className="text-[#7856FF] uppercase text-[10px]">Daily &middot; 10 Members</span>
                </div>
                <p className="text-gray-500 text-[11px]">500 ETB / day &middot; 5,000 ETB pool &middot; Admin: Abebe Bekele (<code>admin.bole.daily@yegnaekub-demo.et</code>)</p>
              </div>

              <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-bold text-gray-900">
                  <span>2. Merkato Weekly Circle</span>
                  <span className="text-[#7856FF] uppercase text-[10px]">Weekly &middot; 20 Members</span>
                </div>
                <p className="text-gray-500 text-[11px]">2,000 ETB / week &middot; 40,000 ETB pool &middot; Admin: Selamawit Tesfaye (<code>admin.merkato.weekly@yegnaekub-demo.et</code>)</p>
              </div>

              <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-bold text-gray-900">
                  <span>3. Piazza Monthly Cooperative</span>
                  <span className="text-[#7856FF] uppercase text-[10px]">Monthly &middot; 30 Members</span>
                </div>
                <p className="text-gray-500 text-[11px]">5,000 ETB / month &middot; 150,000 ETB pool &middot; Admin: Dawit Alemu (<code>admin.piazza.monthly@yegnaekub-demo.et</code>)</p>
              </div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-[11px] text-purple-900 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#7856FF] shrink-0 mt-0.5" />
              <span>The Super Admin is maintained as a platform-level observer and is never enrolled as a member.</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={seedingData}
                onClick={() => setShowSeedConfirmModal(false)}
                className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={seedingData}
                onClick={handleExecuteSeedSampleData}
                className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#7856FF] hover:bg-[#6340FF] rounded-xl shadow-md shadow-[#7856FF]/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {seedingData ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    <span>Provisioning Circles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Confirm &amp; Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE / REJECT MEMBER CONFIRMATION MODAL */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl border border-[#E6E1F5] shadow-2xl space-y-4 text-gray-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1C1132]">Remove Circle Member</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Are you sure you want to remove <strong>{memberToRemove.displayName}</strong> ({memberToRemove.email || memberToRemove.userId}) from this Ekub?
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={processingId === memberToRemove.userId}
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === memberToRemove.userId}
                onClick={handleConfirmRemoveMember}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {processingId === memberToRemove.userId ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
