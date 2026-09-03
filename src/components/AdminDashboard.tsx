import React, { useState, useEffect, useMemo } from 'react';
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
  UserPlus,
  Phone,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Smartphone
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
  getAllUsers
} from '../firebase/ekubService';
import { 
  evaluateMemberContribution, 
  dispatchMemberSms, 
  runAutomaticDueDateCheck, 
  MemberContributionEvaluation,
  buildSmsMessage
} from '../firebase/dueDateService';
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
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  userProfile?: UserProfile | null;
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
  isSuperAdmin: propIsSuperAdmin,
  isAdmin: propIsAdmin,
  userProfile: propUserProfile,
}) => {
  const auth = useAuth();
  const userProfile = propUserProfile !== undefined ? propUserProfile : auth.userProfile;
  const isSuperAdmin = propIsSuperAdmin !== undefined ? propIsSuperAdmin : auth.isSuperAdmin;
  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : auth.isAdmin;
  const { t, language } = useTranslation();

  // Ekub Admins must only ever see/select circles they actually administer
  // -- Super Admin sees everything, matching the platform-wide oversight
  // role. This does NOT affect the "Reassign Ekub Admin" tab's own circle
  // selector further below, which is correctly Super-Admin-only already
  // and needs the full list to reassign any circle.
  const accessibleEkubs = isSuperAdmin ? ekubs : ekubs.filter(e => e.adminId === userProfile?.uid);

  // Active Sub-Tab: Super Admin defaults to 'circles', Ekub Admin defaults to 'due-dates' / 'pending-payments'
  const [activeTab, setActiveTab] = useState<'pending-payments' | 'due-dates' | 'payout-approvals' | 'members' | 'reassign' | 'invite' | 'circles' | 'audit'>(
    isSuperAdmin ? 'circles' : 'due-dates'
  );

  // Due Date & SMS State
  const [dueStatusFilter, setDueStatusFilter] = useState<'all' | 'overdue' | 'due' | 'upcoming' | 'paid'>('all');
  const [syncingDueDates, setSyncingDueDates] = useState(false);
  const [smsModalTarget, setSmsModalTarget] = useState<MemberContributionEvaluation | null>(null);
  const [smsModalType, setSmsModalType] = useState<'3_day_reminder' | 'overdue_alert' | 'manual_reminder'>('3_day_reminder');
  const [smsDispatching, setSmsDispatching] = useState(false);

  // Ensure Super Admin is never on operational payment/payout tabs
  React.useEffect(() => {
    if (isSuperAdmin && (activeTab === 'pending-payments' || activeTab === 'payout-approvals' || activeTab === 'due-dates')) {
      setActiveTab('circles');
    }
  }, [isSuperAdmin, activeTab]);

  // Selected Circle for Member Roster / Operations
  const [selectedEkubId, setSelectedEkubId] = useState<string>(accessibleEkubs[0]?.id || '');

  React.useEffect(() => {
    if (!selectedEkubId && accessibleEkubs.length > 0) {
      setSelectedEkubId(accessibleEkubs[0].id);
    }
  }, [accessibleEkubs, selectedEkubId]);
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
  const [rawPlatformUsers, setRawPlatformUsers] = useState<UserProfile[]>([]);
  // Derived, not stored in state -- always reflects the CURRENT ekubs on
  // every render, so it can never go stale the way filtering inside a
  // one-time fetch effect did.
  const platformUsers = rawPlatformUsers.filter(
    u => !ekubs.some(e => e.adminId === u.uid)
  );
  const [loadingPlatformUsers, setLoadingPlatformUsers] = useState(false);
  const [manualUidEntry, setManualUidEntry] = useState(false);

  // Action status / processing
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  // Modals & confirmation dialogs (safe for sandboxed iframes)
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

  // Load the RAW platform user list when the Reassign tab opens, so the
  // Super Admin can pick a real person instead of pasting a raw Firebase
  // UID. Deliberately does NOT filter here -- filtering against `ekubs`
  // inside this one-time fetch would capture whatever `ekubs` happened to
  // be at that exact moment and never update again (this effect only
  // fires once, gated by rawPlatformUsers.length === 0). The actual
  // "already administering" filter is computed fresh on every render
  // below instead, via `platformUsers`, so it always reflects the latest
  // `ekubs` regardless of when this fetch completed.
  React.useEffect(() => {
    if (activeTab === 'reassign' && rawPlatformUsers.length === 0 && !loadingPlatformUsers) {
      setLoadingPlatformUsers(true);
      getAllUsers()
        .then((users) => setRawPlatformUsers(users))
        .finally(() => setLoadingPlatformUsers(false));
    }
  }, [activeTab]);

  // Load audit logs when switching to audit tab
  React.useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      getAuditLogs()
        .then((logs) => setAuditLogs(Array.isArray(logs) ? logs : []))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab]);

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

  // Computed evaluations for members in the selected Ekub
  const memberEvaluations = useMemo<MemberContributionEvaluation[]>(() => {
    if (!selectedEkub || members.length === 0) return [];
    return members.map(m => {
      const userDoc = rawPlatformUsers.find(u => u.uid === m.userId);
      return evaluateMemberContribution(selectedEkub, m, contributions, userDoc);
    });
  }, [selectedEkub, members, contributions, rawPlatformUsers]);

  const overdueEvaluationsCount = memberEvaluations.filter(e => e.isOverdue).length;
  const dueSoonEvaluationsCount = memberEvaluations.filter(e => e.isDueSoon).length;
  const upcomingEvaluationsCount = memberEvaluations.filter(e => e.status === 'upcoming').length;
  const paidEvaluationsCount = memberEvaluations.filter(e => e.status === 'paid').length;

  const filteredEvaluations = useMemo(() => {
    return memberEvaluations.filter(e => {
      if (dueStatusFilter === 'overdue') return e.isOverdue;
      if (dueStatusFilter === 'due') return e.isDueSoon || e.status === 'due';
      if (dueStatusFilter === 'upcoming') return e.status === 'upcoming';
      if (dueStatusFilter === 'paid') return e.status === 'paid';
      return true;
    });
  }, [memberEvaluations, dueStatusFilter]);

  // Handle Synchronizing Due Dates and Triggering 3-Day SMS Notifications (Ekub Admin only)
  const handleSyncDueDatesAndSms = async () => {
    if (isSuperAdmin) return;
    setSyncingDueDates(true);
    setActionError('');
    setActionSuccess('');
    try {
      const targetEkubs = accessibleEkubs.length > 0 ? accessibleEkubs : [selectedEkub].filter(Boolean);
      const membersMap: Record<string, EkubMember[]> = {
        [selectedEkubId]: members
      };
      
      const result = await runAutomaticDueDateCheck(targetEkubs, membersMap, contributions, rawPlatformUsers);
      
      setActionSuccess(
        `Automatic due date & SMS sync complete: Evaluated ${result.totalChecked} member(s). ` +
        `Dispatched ${result.smsSentCount} SMS notification(s) across Ethio Telecom SMS gateway.`
      );
      
      if (selectedEkubId) {
        const m = await getEkubMembers(selectedEkubId);
        setMembers(Array.isArray(m) ? m : []);
      }
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to sync due dates and SMS reminders.');
    } finally {
      setSyncingDueDates(false);
    }
  };

  // Handle single SMS dispatch from modal (Ekub Admin only)
  const handleSendSingleSms = async () => {
    if (isSuperAdmin || !smsModalTarget) return;
    setSmsDispatching(true);
    try {
      const res = await dispatchMemberSms(smsModalTarget, smsModalType);
      if (res.success) {
        setActionSuccess(`SMS successfully sent to ${smsModalTarget.displayName} (${smsModalTarget.phoneNumber || 'Recipient'}): "${res.text.substring(0, 50)}..."`);
        setSmsModalTarget(null);
        if (selectedEkubId) {
          const m = await getEkubMembers(selectedEkubId);
          setMembers(Array.isArray(m) ? m : []);
        }
        onRefreshData();
      } else {
        setActionError(`Failed to dispatch SMS: Recipient phone number missing or invalid.`);
      }
    } catch (err: any) {
      setActionError(err.message || 'SMS dispatch failed.');
    } finally {
      setSmsDispatching(false);
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

            {!isSuperAdmin && (
              <button
                onClick={handleSyncDueDatesAndSms}
                disabled={syncingDueDates}
                className="px-3.5 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-all flex items-center space-x-1.5 rounded-lg disabled:opacity-50"
                title="Automatically scans all members, dispatches 3-day SMS notices to phone numbers, and flags overdue unpaid contributions in red"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>{syncingDueDates ? 'Checking Due Dates...' : 'Sync Due Dates & SMS'}</span>
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

      {/* Overdue Contribution Critical Red Alert Banner */}
      {!isSuperAdmin && overdueEvaluationsCount > 0 && (
        <div className="p-4 sm:p-5 bg-red-50 border-2 border-red-500/80 rounded-2xl shadow-sm text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-red-900">
                  ⚠️ Overdue Contribution Alert: {overdueEvaluationsCount} Member(s) Unpaid
                </h3>
                <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  Marked in Red
                </span>
              </div>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                Members marked in <strong className="text-red-900 font-bold underline">RED</strong> below have missed their cycle contribution deadline. Live draw eligibility is suspended until payments are received and verified.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => {
                setActiveTab('due-dates');
                setDueStatusFilter('overdue');
              }}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-xs"
            >
              View Overdue ({overdueEvaluationsCount})
            </button>
            <button
              onClick={handleSyncDueDatesAndSms}
              disabled={syncingDueDates}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-100/60 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              Dispatch Overdue SMS
            </button>
          </div>
        </div>
      )}

      {/* Secondary Sub-Tabs */}
      <div className="flex flex-wrap border-b border-[#E6E1F5] gap-2 pb-px text-xs font-bold uppercase tracking-wider">
        {/* Ekub Admin Operational Tabs */}
        {!isSuperAdmin && (
          <button
            onClick={() => setActiveTab('due-dates')}
            className={`pb-3 px-3 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'due-dates'
                ? 'border-b-2 border-[#7856FF] text-[#7856FF]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Due Dates &amp; Member SMS</span>
            {overdueEvaluationsCount > 0 ? (
              <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full animate-pulse shadow-xs">
                {overdueEvaluationsCount} Overdue
              </span>
            ) : dueSoonEvaluationsCount > 0 ? (
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                {dueSoonEvaluationsCount} Due Soon
              </span>
            ) : null}
          </button>
        )}

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
            <span>Pending Receipts</span>
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

        {/* Super Admin Governance Tabs */}
        {isSuperAdmin && (
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
        )}

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

        {!isSuperAdmin && (
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
        )}

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

      {/* TAB 0: DUE DATES & MEMBER SMS REMINDERS (Ekub Admin only) */}
      {activeTab === 'due-dates' && !isSuperAdmin && (
        <div className="space-y-5">
          {/* Header & Circle Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-800">
                  Member Contribution Due Dates &amp; Automated SMS Ledger
                </h2>
                {overdueEvaluationsCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">
                    {overdueEvaluationsCount} Overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Automated 3-day SMS reminder engine via Ethio Telecom SMS Gateway. Missed due dates automatically flag members in red.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedEkubId}
                onChange={(e) => setSelectedEkubId(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:border-[#7856FF]"
              >
                {accessibleEkubs.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} (Cycle #{e.currentCycle || 1})
                  </option>
                ))}
              </select>

              <button
                onClick={handleSyncDueDatesAndSms}
                disabled={syncingDueDates}
                className="px-3.5 py-2 bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center space-x-1.5 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingDueDates ? 'animate-spin' : ''}`} />
                <span>{syncingDueDates ? 'Scanning...' : 'Sync Due Dates'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div 
              onClick={() => setDueStatusFilter('overdue')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                dueStatusFilter === 'overdue' 
                  ? 'bg-red-50 border-red-400 ring-2 ring-red-500/20' 
                  : 'bg-white border-[#E6E1F5] hover:border-red-300'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-red-700 uppercase tracking-wider text-[10px]">Overdue (Unpaid)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              </div>
              <p className="text-2xl font-black text-red-600 mt-1">{overdueEvaluationsCount}</p>
              <p className="text-[10px] text-red-600/80 mt-0.5">Flagged in red • Ineligible for draw</p>
            </div>

            <div 
              onClick={() => setDueStatusFilter('due')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                dueStatusFilter === 'due' 
                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20' 
                  : 'bg-white border-[#E6E1F5] hover:border-amber-300'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-amber-700 uppercase tracking-wider text-[10px]">Due Soon (≤ 3 Days)</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-600 mt-1">{dueSoonEvaluationsCount}</p>
              <p className="text-[10px] text-amber-700/80 mt-0.5">3-Day SMS reminders active</p>
            </div>

            <div 
              onClick={() => setDueStatusFilter('upcoming')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                dueStatusFilter === 'upcoming' 
                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20' 
                  : 'bg-white border-[#E6E1F5] hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Upcoming Cycles</span>
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-600 mt-1">{upcomingEvaluationsCount}</p>
              <p className="text-[10px] text-blue-700/80 mt-0.5">Due in &gt; 3 days</p>
            </div>

            <div 
              onClick={() => setDueStatusFilter('paid')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                dueStatusFilter === 'paid' 
                  ? 'bg-green-50 border-green-400 ring-2 ring-green-500/20' 
                  : 'bg-white border-[#E6E1F5] hover:border-green-300'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-green-700 uppercase tracking-wider text-[10px]">Paid &amp; Verified</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              </div>
              <p className="text-2xl font-black text-green-600 mt-1">{paidEvaluationsCount}</p>
              <p className="text-[10px] text-green-700/80 mt-0.5">Draw eligible confirmed</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setDueStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${
                dueStatusFilter === 'all'
                  ? 'bg-[#1C1132] text-white border-[#1C1132]'
                  : 'bg-white text-gray-600 border-[#E6E1F5] hover:bg-gray-50'
              }`}
            >
              All Members ({memberEvaluations.length})
            </button>
            <button
              onClick={() => setDueStatusFilter('overdue')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${
                dueStatusFilter === 'overdue'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              Overdue ({overdueEvaluationsCount})
            </button>
            <button
              onClick={() => setDueStatusFilter('due')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${
                dueStatusFilter === 'due'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Due Soon - 3-Day SMS ({dueSoonEvaluationsCount})
            </button>
            <button
              onClick={() => setDueStatusFilter('upcoming')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${
                dueStatusFilter === 'upcoming'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              Upcoming ({upcomingEvaluationsCount})
            </button>
            <button
              onClick={() => setDueStatusFilter('paid')}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border ${
                dueStatusFilter === 'paid'
                  ? 'bg-green-600 text-white border-green-600 shadow-xs'
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              }`}
            >
              Paid &amp; Verified ({paidEvaluationsCount})
            </button>
          </div>

          {/* Members Due Date Table */}
          {loadingMembers ? (
            <div className="p-12 text-center bg-white border border-[#E6E1F5] rounded-xl">
              <div className="w-8 h-8 border-2 border-[#7856FF] border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Evaluating Due Dates &amp; SMS Status...</p>
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="bg-white p-12 text-center border border-[#E6E1F5] rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900">No Members Match Selected Filter</h3>
              <p className="text-xs text-gray-500 mt-1">Try selecting another filter above or switch the circle.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E1F5] rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F7FC] border-b border-[#E6E1F5] text-gray-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Member &amp; Phone</th>
                      <th className="py-3 px-4">Contribution Required</th>
                      <th className="py-3 px-4">Due Date &amp; Timeline</th>
                      <th className="py-3 px-4">Payment Status</th>
                      <th className="py-3 px-4">SMS Notice Tracking</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEvaluations.map((ev) => (
                      <tr 
                        key={ev.userId} 
                        className={`transition-colors ${
                          ev.isOverdue 
                            ? 'bg-red-50/80 hover:bg-red-100/60 border-l-4 border-l-red-600' 
                            : ev.isDueSoon 
                            ? 'bg-amber-50/40 hover:bg-amber-50/80 border-l-4 border-l-amber-500' 
                            : 'hover:bg-gray-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <p className={`font-bold ${ev.isOverdue ? 'text-red-950 font-black' : 'text-gray-900'}`}>
                            {ev.displayName}
                          </p>
                          <div className="flex items-center space-x-1 text-[11px] text-gray-500 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="font-mono">{ev.phoneNumber || ev.email || 'No phone'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900 font-mono">
                            {ev.contributionAmount.toLocaleString()} ETB
                          </p>
                          <span className="text-[10px] uppercase font-bold text-[#7856FF]">
                            Cycle #{ev.cycleNumber}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className={`font-bold text-xs ${ev.isOverdue ? 'text-red-700 font-black' : 'text-gray-800'}`}>
                            {ev.dueDate}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {ev.isOverdue ? (
                              <span className="text-red-700 font-bold">⚠️ Missed ({ev.daysOverdue} day{ev.daysOverdue === 1 ? '' : 's'} past due)</span>
                            ) : ev.isDueSoon ? (
                              <span className="text-amber-700 font-bold">⏰ {ev.daysRemaining} day{ev.daysRemaining === 1 ? '' : 's'} left</span>
                            ) : ev.status === 'paid' ? (
                              <span className="text-green-700 font-medium">Verified for this cycle</span>
                            ) : (
                              <span>Due in {ev.daysRemaining} days</span>
                            )}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          {ev.isOverdue ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 text-white font-black uppercase text-[10px] tracking-wider shadow-xs animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                OVERDUE (UNPAID)
                              </span>
                              <p className="text-[10px] text-red-700 font-bold mt-1">Draw Ineligible</p>
                            </div>
                          ) : ev.isDueSoon ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase text-[10px] tracking-wider">
                                <Clock className="w-3 h-3 text-amber-600" />
                                DUE SOON (3-DAY)
                              </span>
                              <p className="text-[10px] text-amber-700 font-medium mt-1">Pending receipt</p>
                            </div>
                          ) : ev.status === 'paid' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-bold uppercase text-[10px] tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-green-600" />
                                PAID &amp; VERIFIED
                              </span>
                              <p className="text-[10px] text-green-700 font-medium mt-1">Draw Eligible</p>
                            </div>
                          ) : ev.status === 'pending' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-purple-50 text-[#7856FF] border border-purple-200 font-bold uppercase text-[10px] tracking-wider">
                                <Receipt className="w-3 h-3 text-[#7856FF]" />
                                UNDER AUDIT
                              </span>
                              <p className="text-[10px] text-purple-700 font-medium mt-1">Receipt uploaded</p>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase text-[10px] tracking-wider">
                                UPCOMING
                              </span>
                              <p className="text-[10px] text-gray-500 font-medium mt-1">Awaiting due window</p>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {ev.smsStatus?.reminderSentAt || ev.smsStatus?.overdueAlertSentAt ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-purple-100 text-[#7856FF] border border-purple-200 rounded text-[9px] font-bold uppercase tracking-wider">
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>SMS Sent</span>
                              </span>
                              <p className="text-[10px] text-gray-500">
                                {new Date(ev.smsStatus.overdueAlertSentAt || ev.smsStatus.reminderSentAt || '').toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-mono">Not dispatched</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {ev.isOverdue ? (
                            <button
                              onClick={() => {
                                setSmsModalTarget(ev);
                                setSmsModalType('overdue_alert');
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-[10px] uppercase tracking-wider transition-colors inline-flex items-center space-x-1 shadow-xs"
                            >
                              <Send className="w-3 h-3" />
                              <span>SMS Overdue Alert</span>
                            </button>
                          ) : ev.isDueSoon ? (
                            <button
                              onClick={() => {
                                setSmsModalTarget(ev);
                                setSmsModalType('3_day_reminder');
                              }}
                              className="px-2.5 py-1 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold rounded text-[10px] uppercase tracking-wider transition-colors inline-flex items-center space-x-1 shadow-xs"
                            >
                              <Send className="w-3 h-3" />
                              <span>Send 3-Day SMS</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSmsModalTarget(ev);
                                setSmsModalType('manual_reminder');
                              }}
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[10px] uppercase tracking-wider transition-colors inline-flex items-center space-x-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Custom SMS</span>
                            </button>
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

      {/* TAB 1: PENDING PAYMENTS AUDIT (Ekub Admin only) */}
      {activeTab === 'pending-payments' && !isSuperAdmin && (
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

      {/* TAB 2: PAYOUT APPROVALS & DISBURSEMENT (Ekub Admin only) */}
      {activeTab === 'payout-approvals' && !isSuperAdmin && (
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
                      <th className="py-3 px-4">Membership</th>
                      <th className="py-3 px-4">Cycle Due Date &amp; Status</th>
                      <th className="py-3 px-4">Draw Eligibility</th>
                      <th className="py-3 px-4">Total Contributed</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map((m) => {
                      const userDoc = rawPlatformUsers.find(u => u.uid === m.userId);
                      const evalStatus = selectedEkub ? evaluateMemberContribution(selectedEkub, m, contributions, userDoc) : null;
                      const isOverdue = evalStatus?.isOverdue || m.contributionStatus === 'overdue';

                      return (
                        <tr 
                          key={m.userId} 
                          className={`transition-colors ${
                            isOverdue 
                              ? 'bg-red-50/70 hover:bg-red-100/50 border-l-4 border-l-red-600' 
                              : evalStatus?.isDueSoon 
                              ? 'bg-amber-50/30 hover:bg-amber-50/70 border-l-4 border-l-amber-500' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <p className={`font-bold ${isOverdue ? 'text-red-950 font-black' : 'text-gray-900'}`}>{m.displayName}</p>
                            <p className="text-[10px] text-gray-500">{m.email || m.userId}</p>
                            {evalStatus?.phoneNumber && (
                              <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{evalStatus.phoneNumber}</span>
                              </p>
                            )}
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
                            {isOverdue ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-black uppercase text-[10px] tracking-wider shadow-xs animate-pulse">
                                  <AlertTriangle className="w-3 h-3" />
                                  OVERDUE
                                </span>
                                <p className="text-[10px] text-red-700 font-bold mt-0.5">
                                  {evalStatus?.dueDate} ({evalStatus?.daysOverdue || 1}d late)
                                </p>
                              </div>
                            ) : evalStatus?.isDueSoon ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold uppercase text-[10px] tracking-wider">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  DUE SOON
                                </span>
                                <p className="text-[10px] text-amber-700 mt-0.5">
                                  {evalStatus.dueDate} ({evalStatus.daysRemaining}d left)
                                </p>
                              </div>
                            ) : evalStatus?.status === 'paid' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-bold uppercase text-[10px] tracking-wider">
                                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  PAID
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase text-[10px] tracking-wider">
                                  UPCOMING
                                </span>
                                {evalStatus?.dueDate && (
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {evalStatus.dueDate}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {m.hasReceivedPayout ? (
                              <span className="text-gray-400 font-medium">Won (Ineligible)</span>
                            ) : isOverdue ? (
                              <span className="text-red-700 font-bold">Suspended (Overdue)</span>
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
                            <div className="flex items-center justify-end gap-1.5">
                              {!isSuperAdmin && evalStatus && (
                                <button
                                  onClick={() => {
                                    setSmsModalTarget(evalStatus);
                                    setSmsModalType(isOverdue ? 'overdue_alert' : evalStatus.isDueSoon ? '3_day_reminder' : 'manual_reminder');
                                  }}
                                  title="Send direct SMS notification to member"
                                  className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center space-x-1 ${
                                    isOverdue 
                                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs' 
                                      : 'bg-purple-50 hover:bg-purple-100 text-[#7856FF] border border-purple-200'
                                  }`}
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{isOverdue ? 'SMS Alert' : 'SMS'}</span>
                                </button>
                              )}

                              {m.status === 'pending' && canManageCurrentEkub ? (
                                <>
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
                                </>
                              ) : canManageCurrentEkub && m.role !== 'admin' ? (
                                <button
                                  onClick={() => setMemberToRemove(m)}
                                  disabled={processingId === m.userId}
                                  className="text-red-500 hover:text-red-700 text-[11px] font-bold uppercase tracking-wider hover:underline"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

                {/* Super Admin can only view the list of circles and members, and does not have access to or view live draws.
                    Ekub Admin is the only role that can launch and manage a draw for their circle. */}
                {!isSuperAdmin && e.adminId === userProfile?.uid && (
                  <button
                    onClick={() => onOpenLiveDraw(e)}
                    className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center space-x-1.5 rounded-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Launch Live Draw</span>
                  </button>
                )}
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
                getAuditLogs()
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

      {/* SMS DISPATCH & PREVIEW MODAL (Ekub Admin only) */}
      {!isSuperAdmin && smsModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 rounded-2xl border border-[#E6E1F5] shadow-2xl space-y-4 text-gray-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  smsModalType === 'overdue_alert' 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-[#7856FF]/10 text-[#7856FF]'
                }`}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C1132]">
                    {smsModalType === 'overdue_alert'
                      ? 'Dispatch Overdue SMS Alert'
                      : smsModalType === '3_day_reminder'
                      ? 'Dispatch 3-Day SMS Due Reminder'
                      : 'Dispatch Member SMS Notice'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Direct SMS delivery to member's registered mobile number
                  </p>
                </div>
              </div>
              <button 
                onClick={() => !smsDispatching && setSmsModalTarget(null)} 
                disabled={smsDispatching}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient Details */}
            <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Recipient:</span>
                <span className="font-bold text-gray-900">{smsModalTarget.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone Number:</span>
                <span className="font-mono font-bold text-[#7856FF]">{smsModalTarget.phoneNumber || 'No phone on file'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ekub &amp; Cycle:</span>
                <span className="font-bold text-gray-800">{smsModalTarget.ekubName} (Cycle #{smsModalTarget.cycleNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Due:</span>
                <span className="font-bold text-gray-900">{smsModalTarget.contributionAmount.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Due Date:</span>
                <span className={`font-bold ${smsModalTarget.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {smsModalTarget.dueDate} {smsModalTarget.isOverdue && `(${smsModalTarget.daysOverdue} days overdue)`}
                </span>
              </div>
            </div>

            {/* Template Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                Notification Template
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSmsModalType('3_day_reminder')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    smsModalType === '3_day_reminder'
                      ? 'bg-[#7856FF] text-white border-[#7856FF] shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  ⏰ 3-Day Due Notice
                </button>
                <button
                  type="button"
                  onClick={() => setSmsModalType('overdue_alert')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    smsModalType === 'overdue_alert'
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  ⚠️ Overdue Urgent Alert
                </button>
              </div>
            </div>

            {/* Live SMS Preview Box */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-[#7856FF]" />
                  <span>SMS Payload Preview</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Ethio Telecom SMS Gateway</span>
              </div>
              <div className="p-3.5 bg-gray-950 text-green-400 font-mono text-xs rounded-xl border border-gray-800 space-y-2 leading-relaxed shadow-inner">
                <p className="text-gray-300">
                  {smsModalType === 'overdue_alert' ? (
                    `[YEGNA EKUB ALERT] Dear ${smsModalTarget.displayName}, your contribution of ${smsModalTarget.contributionAmount.toLocaleString()} ETB for "${smsModalTarget.ekubName}" was due on ${smsModalTarget.dueDate} and is now OVERDUE. Please transfer via Telebirr/CBE and upload your receipt immediately to maintain draw eligibility.`
                  ) : (
                    `[YEGNA EKUB REMINDER] Dear ${smsModalTarget.displayName}, this is a reminder that your contribution of ${smsModalTarget.contributionAmount.toLocaleString()} ETB for "${smsModalTarget.ekubName}" is due on ${smsModalTarget.dueDate} (in 3 days). Please submit your payment receipt in the app.`
                  )}
                </p>
                <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-400">
                  <span>Sender ID: <strong>YEGNAEKUB</strong> • Delivery: Instant SMS</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={smsDispatching}
                onClick={() => setSmsModalTarget(null)}
                className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={smsDispatching || !smsModalTarget.phoneNumber}
                onClick={handleSendSingleSms}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-white rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50 ${
                  smsModalType === 'overdue_alert'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#7856FF] hover:bg-[#6340FF]'
                }`}
              >
                {smsDispatching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    <span>Dispatching SMS...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmit SMS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
