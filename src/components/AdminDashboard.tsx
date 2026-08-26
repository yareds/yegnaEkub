import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Coins, 
  Receipt, 
  Sparkles, 
  Banknote, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Search, 
  Filter, 
  Eye, 
  RotateCw, 
  Check, 
  X,
  ExternalLink,
  MessageSquare,
  Lock,
  Plus,
  UserCheck,
  UserPlus,
  ChevronRight,
  Building2
} from 'lucide-react';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, EkubMember, Contribution, Draw, Payout, AuditLog, SupportTicket } from '../types';
import { 
  verifyPayment, 
  rejectPayment, 
  approvePayout, 
  disbursePayout, 
  getAuditLogs, 
  assignEkubAdmin,
  getEkubMembers,
  approveMembershipRequest,
  removeEkubMember,
  inviteMember
} from '../firebase/ekubService';

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
  const { userProfile, isSuperAdmin } = useAuth();
  const { t, language } = useTranslation();

  // Selected Scope Filter (for Super Admin: 'all' or specific ekubId; for Ekub Admin: fixed to their own Ekubs)
  const [selectedEkubFilter, setSelectedEkubFilter] = useState<string>('all');

  // Available Ekubs scoped by role
  const userAdminEkubs = ekubs.filter(e => e.adminId === userProfile?.uid);
  const accessibleEkubs = isSuperAdmin ? ekubs : userAdminEkubs;

  // Filtered dataset based on role & active scope
  const activeEkubList = isSuperAdmin 
    ? (selectedEkubFilter === 'all' ? ekubs : ekubs.filter(e => e.id === selectedEkubFilter))
    : (selectedEkubFilter === 'all' ? userAdminEkubs : userAdminEkubs.filter(e => e.id === selectedEkubFilter));

  const activeEkubIds = new Set(activeEkubList.map(e => e.id));

  const scopedContributions = (contributions || []).filter(c => activeEkubIds.has(c.ekubId));
  const scopedDraws = (draws || []).filter(d => activeEkubIds.has(d.ekubId));
  const scopedPayouts = (payouts || []).filter(p => activeEkubIds.has(p.ekubId));

  // Tabs
  const [activeTab, setActiveTab] = useState<'receipts' | 'members' | 'draws' | 'payouts' | 'manage_admins' | 'disputes' | 'audit'>('receipts');
  
  // Modals & Action States
  const [inspectReceipt, setInspectReceipt] = useState<Contribution | null>(null);
  const [rejectingContribId, setRejectingContribId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Transaction reference not found on bank statement.');
  const [disbursingPayoutId, setDisbursingPayoutId] = useState<string | null>(null);
  const [payoutBankRef, setPayoutBankRef] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Members tab state (pending requests + active roster for the currently
  // scoped Ekub(s))
  const [membersByEkub, setMembersByEkub] = useState<Record<string, EkubMember[]>>({});
  const [loadingMemberRoster, setLoadingMemberRoster] = useState(false);
  const [processingMemberId, setProcessingMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'members' && activeEkubList.length > 0) {
      setLoadingMemberRoster(true);
      // Fetch each Ekub's roster independently so one failing Ekub (e.g. a
      // permission error) doesn't wipe out the roster for every other Ekub
      // in the list -- and so a rejection here is always handled, never an
      // unhandled promise rejection.
      Promise.all(
        activeEkubList.map(async (e) => {
          try {
            return [e.id, await getEkubMembers(e.id)] as const;
          } catch (err: any) {
            console.error(`Failed to load members for ${e.id}:`, err);
            return [e.id, []] as const;
          }
        })
      )
        .then((pairs) => {
          const map: Record<string, EkubMember[]> = {};
          pairs.forEach(([id, members]) => { map[id] = members; });
          setMembersByEkub(map);
        })
        .catch((err) => {
          console.error('Failed to load member rosters:', err);
          setActionError(err?.message || 'Failed to load member rosters.');
        })
        .finally(() => setLoadingMemberRoster(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedEkubFilter]);

  const handleApproveMember = async (ekubId: string, userId: string) => {
    setProcessingMemberId(userId);
    setActionError('');
    try {
      await approveMembershipRequest(ekubId, userId);
      setActionSuccess('Membership request approved.');
      const refreshed = await getEkubMembers(ekubId);
      setMembersByEkub(prev => ({ ...prev, [ekubId]: refreshed }));
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve request.');
    } finally {
      setProcessingMemberId(null);
    }
  };

  const handleRemoveMember = async (ekubId: string, userId: string, isPending: boolean) => {
    const confirmMsg = isPending
      ? 'Reject this membership request?'
      : 'Remove this member from the Ekub? This cannot be undone.';
    if (!window.confirm(confirmMsg)) return;
    setProcessingMemberId(userId);
    setActionError('');
    try {
      await removeEkubMember(ekubId, userId);
      setActionSuccess(isPending ? 'Request rejected.' : 'Member removed.');
      const refreshed = await getEkubMembers(ekubId);
      setMembersByEkub(prev => ({ ...prev, [ekubId]: refreshed }));
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member.');
    } finally {
      setProcessingMemberId(null);
    }
  };

  // Invite a brand-new person to the platform (public self-registration has
  // been removed -- this is now the only way a new account gets created).
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitingUser, setInvitingUser] = useState(false);
  const [inviteResetLink, setInviteResetLink] = useState<string | null>(null);
  const [inviteUid, setInviteUid] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<'link' | 'uid' | null>(null);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteFullName.trim()) return;
    setInvitingUser(true);
    setActionError('');
    setInviteResetLink(null);
    setInviteUid(null);
    try {
      const { resetLink, uid } = await inviteMember(inviteEmail.trim(), inviteFullName.trim(), invitePhone.trim());
      setInviteResetLink(resetLink);
      setInviteUid(uid);
      setInviteEmail('');
      setInviteFullName('');
      setInvitePhone('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to invite member.');
    } finally {
      setInvitingUser(false);
    }
  };

  // Manage Ekub Admins state (Super Admin exclusive)
  const [targetEkubIdForAdmin, setTargetEkubIdForAdmin] = useState<string>(ekubs[0]?.id || '');
  const [ekubMembersList, setEkubMembersList] = useState<EkubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberForAdmin, setSelectedMemberForAdmin] = useState<string>('');
  const [customNewAdminUid, setCustomNewAdminUid] = useState('');
  const [customNewAdminName, setCustomNewAdminName] = useState('');
  const [isAssigningAdmin, setIsAssigningAdmin] = useState(false);

  const pendingContributions = scopedContributions.filter(c => c.status === 'pending');
  const pendingPayouts = scopedPayouts.filter(p => p.status === 'under_review' || p.status === 'approved' || p.status === 'documents_required');
  const openTickets = (supportTickets || []).filter(t => t.status === 'open' || t.status === 'in_progress');

  const totalVolume = scopedContributions
    .filter(c => c.status === 'verified')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  useEffect(() => {
    if (ekubs.length > 0 && !targetEkubIdForAdmin) {
      setTargetEkubIdForAdmin(ekubs[0].id);
    }
  }, [ekubs]);

  useEffect(() => {
    if (targetEkubIdForAdmin) {
      setLoadingMembers(true);
      getEkubMembers(targetEkubIdForAdmin)
        .then((m) => {
          setEkubMembersList(m || []);
          setLoadingMembers(false);
        })
        .catch(() => setLoadingMembers(false));
    }
  }, [targetEkubIdForAdmin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectReceipt(null);
        setRejectingContribId(null);
        setDisbursingPayoutId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      getAuditLogs().then((logs) => {
        setAuditLogs(logs);
        setLoadingAudit(false);
      });
    }
  }, [activeTab]);

  const handleVerify = async (c: Contribution) => {
    try {
      await verifyPayment(c.ekubId, c.id, userProfile?.uid || 'admin', userProfile?.fullName || 'Super Admin');
      setActionSuccess(`Payment of ${c.amount.toLocaleString()} ETB for ${c.userName} successfully verified!`);
      onRefreshData();
      setTimeout(() => setActionSuccess(''), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Verification failed.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  const handleReject = async (c: Contribution) => {
    try {
      await rejectPayment(c.ekubId, c.id, userProfile?.uid || 'admin', userProfile?.fullName || 'Super Admin', rejectionReason);
      setRejectingContribId(null);
      setActionSuccess(`Payment submission rejected and member notified.`);
      onRefreshData();
      setTimeout(() => setActionSuccess(''), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Rejection failed.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  const handleApprovePayout = async (p: Payout) => {
    try {
      await approvePayout(p.ekubId, p.id);
      setActionSuccess(`Payout of ${p.amount.toLocaleString()} ETB for ${p.winnerName} approved for disbursement.`);
      onRefreshData();
      setTimeout(() => setActionSuccess(''), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Approval failed.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  const handleDisbursePayout = async (p: Payout) => {
    if (!payoutBankRef.trim()) return;
    try {
      await disbursePayout(p.ekubId, p.id, payoutBankRef);
      setDisbursingPayoutId(null);
      setPayoutBankRef('');
      setActionSuccess(`Payout marked as Disbursed via bank wire ref: ${payoutBankRef}`);
      onRefreshData();
      setTimeout(() => setActionSuccess(''), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Disbursement failed.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  const handleAssignAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEkubIdForAdmin) return;

    let newUid = customNewAdminUid.trim();
    let newName = customNewAdminName.trim();

    if (selectedMemberForAdmin) {
      const member = ekubMembersList.find(m => m.userId === selectedMemberForAdmin);
      if (member) {
        newUid = member.userId;
        newName = member.displayName;
      }
    }

    if (!newUid) {
      setActionError('Please select or specify a valid User ID to assign as Admin.');
      setTimeout(() => setActionError(''), 4000);
      return;
    }

    if (newUid === userProfile?.uid) {
      setActionError('The Super Admin cannot be assigned as an Ekub\u2019s Admin -- the Super Admin is never a member of any circle.');
      setTimeout(() => setActionError(''), 4000);
      return;
    }

    setIsAssigningAdmin(true);
    setActionError('');
    try {
      await assignEkubAdmin(targetEkubIdForAdmin, newUid, newName || 'Ekub Admin');
      setActionSuccess(`Successfully reassigned Admin for Ekub to ${newName || newUid}!`);
      setSelectedMemberForAdmin('');
      setCustomNewAdminUid('');
      setCustomNewAdminName('');
      onRefreshData();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reassign Ekub Admin.');
      setTimeout(() => setActionError(''), 4000);
    } finally {
      setIsAssigningAdmin(false);
    }
  };

  const targetEkubObj = ekubs.find(e => e.id === targetEkubIdForAdmin);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Admin Title Header with Role Badging and Circle Scope Selector */}
      <div className="bg-[#1C1132] text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-[#7856FF]/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {isSuperAdmin ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Super Admin • Global Platform Governance</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ekub Admin • Scoped Circle Management</span>
              </span>
            )}

            {/* Scope indicator */}
            <span className="text-xs text-purple-300 font-mono bg-white/10 px-2.5 py-0.5 rounded-full">
              {isSuperAdmin 
                ? (selectedEkubFilter === 'all' ? 'All Circles' : `Scoped: ${activeEkubList[0]?.name || selectedEkubFilter}`)
                : `${activeEkubList.length} Assigned Circle(s)`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold">
            {t.adminDashboard}
          </h1>
          <p className="text-xs text-white/80 mt-1 max-w-xl">
            {isSuperAdmin 
              ? 'Full platform oversight: audit slips, govern Ekub admins, verify bank settlements, and inspect immutable audit ledgers.'
              : 'Circle management desk: verify member deposits, launch cryptographic live draws, and authorize winner payouts for your circle.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Scope Dropdown Picker */}
          {isSuperAdmin && (
            <div className="flex items-center space-x-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
              <Filter className="w-3.5 h-3.5 text-purple-300 ml-2" />
              <select
                value={selectedEkubFilter}
                onChange={(e) => setSelectedEkubFilter(e.target.value)}
                className="bg-transparent text-white text-xs font-medium outline-none pr-3 py-1 cursor-pointer"
              >
                <option value="all" className="bg-[#1C1132] text-white">All Ekub Circles (Global)</option>
                {ekubs.map(e => (
                  <option key={e.id} value={e.id} className="bg-[#1C1132] text-white">{e.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Only Super Admin can create brand new Ekub circles */}
          {isSuperAdmin && (
            <button
              onClick={onOpenCreateEkub}
              className="px-4 py-2.5 rounded-xl bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Ekub</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts / Feedback */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Scoped Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E6E1F5] shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500 uppercase">{t.activeEkubs}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activeEkubList.length}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Scoped Circles</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E6E1F5] shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500 uppercase">{t.pendingVerifications}</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{pendingContributions.length}</p>
          <p className="text-[10px] text-amber-700 mt-0.5">Awaiting Audit</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E6E1F5] shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500 uppercase">{t.pendingPayouts}</p>
          <p className="text-xl font-bold text-[#7856FF] mt-1">{pendingPayouts.length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">In Disbursement Pipeline</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E6E1F5] shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500 uppercase">{t.totalVolume}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {totalVolume.toLocaleString()} ETB
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Verified Volume</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E6E1F5] shadow-sm">
          <p className="text-[11px] font-semibold text-gray-500 uppercase">Support Disputes</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{openTickets.length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Active Tickets</p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto space-x-2">
        <button
          onClick={() => setActiveTab('receipts')}
          className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
            activeTab === 'receipts'
              ? 'border-[#7856FF] text-[#7856FF]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Pending Bank Receipts ({pendingContributions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
            activeTab === 'members'
              ? 'border-[#7856FF] text-[#7856FF]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members</span>
        </button>

        <button
          onClick={() => setActiveTab('draws')}
          className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
            activeTab === 'draws'
              ? 'border-[#7856FF] text-[#7856FF]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#7856FF]" />
          <span>Live Draw Controller</span>
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
            activeTab === 'payouts'
              ? 'border-[#7856FF] text-[#7856FF]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Payout Clearances ({pendingPayouts.length})</span>
        </button>

        {/* Super Admin Exclusive: Manage Ekub Admins */}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('manage_admins')}
            className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'manage_admins'
                ? 'border-[#7856FF] text-[#7856FF]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Manage Ekub Admins</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('disputes')}
          className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
            activeTab === 'disputes'
              ? 'border-[#7856FF] text-[#7856FF]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Disputes & Tickets ({openTickets.length})</span>
        </button>

        {/* Audit tab: Super Admin only. The Firestore rule for auditLogs
            depends on resource.data.ekubId with no matching query filter in
            getAuditLogs() -- an unfiltered list query with a field-dependent
            rule is rejected outright for anyone who isn't provably covered
            by a document-independent branch (Super Admin is; Ekub Admin
            isn't). Restricting this tab to Super Admin avoids that error
            rather than hitting it. */}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center space-x-1.5 transition-all ${
              activeTab === 'audit'
                ? 'border-[#7856FF] text-[#7856FF]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Immutable Audit Logs</span>
          </button>
        )}
      </div>

      {/* TAB: MEMBER MANAGEMENT -- pending requests + active roster */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm space-y-6">
          {/* Invite a new person to the platform. Public self-registration
              has been removed, so this is the only way a brand-new account
              gets created. */}
          <div className="border border-[#E6E1F5] rounded-xl overflow-hidden">
            <button
              onClick={() => { setShowInviteForm(!showInviteForm); setInviteResetLink(null); }}
              className="w-full px-4 py-3 bg-[#F8F7FC] flex items-center justify-between text-sm font-bold text-[#1C1132]"
            >
              <span className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#7856FF]" />
                <span>Invite a New Person</span>
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showInviteForm ? 'rotate-90' : ''}`} />
            </button>

            {showInviteForm && (
              <div className="p-4">
                {inviteResetLink ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                      Account created. Share the link below with them so they can set their
                      password and sign in -- it is not sent automatically. Copy their UID too
                      if you're about to assign them as an Ekub Admin (Create Ekub or Reassign
                      Admin both need it).
                    </div>

                    <div>
                      <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                        Password Setup Link (share with them)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          readOnly
                          value={inviteResetLink}
                          className="flex-1 p-2.5 text-[11px] font-mono border border-[#E6E1F5] rounded-lg bg-gray-50 truncate"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteResetLink);
                            setInviteCopied('link');
                            setTimeout(() => setInviteCopied(null), 2000);
                          }}
                          className="px-3 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-[10px] font-bold uppercase rounded-lg shrink-0"
                        >
                          {inviteCopied === 'link' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {inviteUid && (
                      <div>
                        <label className="block font-bold text-[10px] text-gray-700 uppercase tracking-wider mb-1">
                          Their Firebase UID (needed to assign them as Ekub Admin)
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            readOnly
                            value={inviteUid}
                            className="flex-1 p-2.5 text-[11px] font-mono border border-[#E6E1F5] rounded-lg bg-gray-50 truncate"
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(inviteUid);
                              setInviteCopied('uid');
                              setTimeout(() => setInviteCopied(null), 2000);
                            }}
                            className="px-3 py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-[10px] font-bold uppercase rounded-lg shrink-0"
                          >
                            {inviteCopied === 'uid' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => { setInviteResetLink(null); setInviteUid(null); }}
                      className="text-[11px] font-bold text-[#7856FF] hover:underline"
                    >
                      Invite someone else
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleInviteMember} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      placeholder="Full name"
                      className="w-full p-2.5 text-xs border border-[#E6E1F5] rounded-lg outline-none focus:border-[#7856FF]"
                    />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full p-2.5 text-xs border border-[#E6E1F5] rounded-lg outline-none focus:border-[#7856FF]"
                    />
                    <input
                      type="tel"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="Phone number (optional)"
                      className="w-full p-2.5 text-xs border border-[#E6E1F5] rounded-lg outline-none focus:border-[#7856FF]"
                    />
                    <button
                      type="submit"
                      disabled={invitingUser}
                      className="w-full py-2.5 bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold uppercase rounded-lg disabled:opacity-50"
                    >
                      {invitingUser ? 'Sending Invite...' : 'Create Account & Get Invite Link'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {loadingMemberRoster ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-[#7856FF] border-t-transparent animate-spin rounded-full" />
            </div>
          ) : activeEkubList.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No Ekub selected or assigned yet.</p>
          ) : (
            activeEkubList.map((ekub) => {
              const members = membersByEkub[ekub.id] || [];
              const pending = members.filter(m => m.status === 'pending');
              const active = members.filter(m => m.status !== 'pending');
              return (
                <div key={ekub.id} className="border border-[#E6E1F5] rounded-xl overflow-hidden">
                  <div className="bg-[#F8F7FC] px-4 py-3 border-b border-[#E6E1F5]">
                    <h3 className="text-sm font-bold text-[#1C1132]">{ekub.name}</h3>
                    <p className="text-[11px] text-gray-500">{active.length} active member(s) &middot; {pending.length} pending request(s)</p>
                  </div>

                  {pending.length > 0 && (
                    <div className="p-4 space-y-2 border-b border-[#E6E1F5]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">Pending Requests</p>
                      {pending.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-gray-900">{m.displayName}</p>
                            {m.email && <p className="text-[10px] text-gray-500">{m.email}</p>}
                          </div>
                          <div className="flex items-center space-x-2">
                            {isSuperAdmin ? (
                              <span className="text-[10px] text-gray-400 italic">View only -- managed by the Ekub Admin</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApproveMember(ekub.id, m.userId)}
                                  disabled={processingMemberId === m.userId}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold uppercase rounded-md transition-colors disabled:opacity-50"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(ekub.id, m.userId, true)}
                                  disabled={processingMemberId === m.userId}
                                  className="px-3 py-1.5 bg-white border border-red-300 hover:bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-md transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Active Members</p>
                    {active.length === 0 ? (
                      <p className="text-xs text-gray-400">No active members yet.</p>
                    ) : (
                      active.map((m) => (
                        <div key={m.userId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50">
                          <div>
                            <p className="text-xs font-bold text-gray-900">
                              {m.displayName}{' '}
                              {m.role === 'admin' && (
                                <span className="ml-1 text-[9px] bg-[#7856FF]/15 text-[#7856FF] px-1.5 py-0.5 rounded uppercase font-bold">Admin</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {m.contributionStatus} &middot; {m.eligibleForDraw ? 'Eligible for draw' : 'Not yet eligible'}
                            </p>
                          </div>
                          {m.role !== 'admin' && !isSuperAdmin && (
                            <button
                              onClick={() => handleRemoveMember(ekub.id, m.userId, false)}
                              disabled={processingMemberId === m.userId}
                              className="px-3 py-1.5 bg-white border border-red-300 hover:bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-md transition-colors disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 1: PENDING RECEIPTS VERIFICATION */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Bank Receipt Audit Queue
              </h2>
              <p className="text-xs text-gray-500">
                Inspect member transaction slips, verify against Telebirr/CBE statements, and mark ledger status.
              </p>
            </div>
          </div>

          {pendingContributions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-800">All submissions verified!</p>
              <p className="text-gray-400 mt-0.5">No pending payment slips in queue for active scope.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingContributions.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-[#F8F7FC] border border-[#E6E1F5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-gray-900">{c.userName}</span>
                      <span className="text-xs text-gray-500">({c.userEmail})</span>
                      <span className="px-2 py-0.5 bg-[#7856FF] text-white text-[10px] font-bold rounded">
                        {c.paymentMethod.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700">
                      Ekub: <strong>{c.ekubName}</strong> (Cycle #{c.cycleNumber}) • Amount: <strong className="text-[#7856FF]">{c.amount.toLocaleString()} ETB</strong>
                    </p>

                    <div className="flex items-center space-x-3 text-[11px] text-gray-500 font-mono">
                      <span>Ref: <strong>{c.transactionReference}</strong></span>
                      <span>•</span>
                      <span>Submitted: {c.submittedAt.split('T')[0]}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 self-end lg:self-center">
                    <button
                      onClick={() => setInspectReceipt(c)}
                      className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Receipt</span>
                    </button>

                    <button
                      onClick={() => setRejectingContribId(c.id)}
                      className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleVerify(c)}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 shadow-sm transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Verify</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE DRAW CONTROLLER */}
      {activeTab === 'draws' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Scheduled Ekub Live Draws
              </h2>
              <p className="text-xs text-gray-500">
                Trigger authoritative server HMAC-SHA256 draws for active circles once contribution verification is complete.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEkubList.map((e) => (
              <div key={e.id} className="p-5 rounded-2xl border border-[#E6E1F5] bg-[#F8F7FC] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 capitalize">
                      {e.status}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{e.frequency}</span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 mt-2">{e.name}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Cycle #{e.currentCycle} of {e.totalCycles} • Pool Pot: <strong className="text-[#7856FF]">{e.payoutAmount.toLocaleString()} ETB</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Next Draw: <strong>{e.nextDrawDate.split('T')[0]} (7:00 PM)</strong>
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-600 font-medium">
                    {e.currentMemberCount} / {e.memberLimit} Members
                  </span>

                  <button
                    onClick={() => onOpenLiveDraw(e)}
                    className="px-4 py-2 rounded-xl bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs flex items-center space-x-1.5 shadow-md transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C4B5FD]" />
                    <span>Launch Live Draw</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PAYOUT CLEARANCES */}
      {activeTab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Winner Payout Disbursement Pipeline
              </h2>
              <p className="text-xs text-gray-500">
                Review submitted winner IDs and bank details, authorize wire transfers, and log references.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {scopedPayouts.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-[#F8F7FC] border border-[#E6E1F5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-gray-900">🎉 {p.winnerName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 capitalize">
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700">
                    Ekub: <strong>{p.ekubName}</strong> (Cycle #{p.cycleNumber}) • Payout Amount: <strong className="text-emerald-700">{p.amount.toLocaleString()} ETB</strong>
                  </p>

                  {p.payoutAccountDetails && (
                    <div className="text-xs text-gray-600 bg-white p-2.5 rounded border border-gray-200 mt-1 space-y-0.5">
                      <p>Bank: <strong>{p.payoutAccountDetails.bankName}</strong></p>
                      <p>Account: <strong className="font-mono">{p.payoutAccountDetails.accountNumber}</strong> ({p.payoutAccountDetails.accountHolderName})</p>
                      {p.paymentReference && <p className="text-emerald-700 font-mono">Disbursed Ref: {p.paymentReference}</p>}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 self-end lg:self-center">
                  {p.status === 'under_review' && (
                    <button
                      onClick={() => handleApprovePayout(p)}
                      className="px-3.5 py-2 rounded-lg bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold transition-colors"
                    >
                      Approve Documents
                    </button>
                  )}

                  {p.status === 'approved' && (
                    <button
                      onClick={() => {
                        setDisbursingPayoutId(p.id);
                        setPayoutBankRef(`CBE-WIRE-${Math.floor(1000000 + Math.random() * 9000000)}`);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center space-x-1"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Disburse Funds</span>
                    </button>
                  )}

                  {p.status === 'paid' && (
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                      ✓ Disbursed & Completed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: MANAGE EKUB ADMINS (Super Admin exclusive) */}
      {isSuperAdmin && activeTab === 'manage_admins' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-[#7856FF]" />
              <span>Ekub Admin Delegation & Governance</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Super Admin privilege: assign or transfer operational administration of a specific Ekub circle to any authenticated user or circle member.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Reassignment Form */}
            <div className="lg:col-span-6 space-y-4">
              <form onSubmit={handleAssignAdminSubmit} className="space-y-4 bg-[#F8F7FC] p-5 rounded-xl border border-[#E6E1F5]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Assign Ekub Admin</h3>
                
                {/* 1. Pick Ekub */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Ekub Circle</label>
                  <select
                    value={targetEkubIdForAdmin}
                    onChange={(e) => {
                      setTargetEkubIdForAdmin(e.target.value);
                      setSelectedMemberForAdmin('');
                    }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#7856FF]"
                  >
                    {ekubs.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} (Current Admin: {e.adminName || e.adminId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Choose Member or Enter UID */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select Member from Circle (Optional)
                  </label>
                  {loadingMembers ? (
                    <p className="text-xs text-gray-400 py-1">Loading members...</p>
                  ) : (
                    <select
                      value={selectedMemberForAdmin}
                      onChange={(e) => {
                        setSelectedMemberForAdmin(e.target.value);
                        if (e.target.value) {
                          const m = ekubMembersList.find(mem => mem.userId === e.target.value);
                          if (m) {
                            setCustomNewAdminUid(m.userId);
                            setCustomNewAdminName(m.displayName);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#7856FF]"
                    >
                      <option value="">-- Choose from existing circle members --</option>
                      {ekubMembersList.map(m => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName} (UID: {m.userId.substring(0, 8)}... | Role: {m.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 3. New Admin UID */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Admin Firebase UID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customNewAdminUid}
                    onChange={(e) => setCustomNewAdminUid(e.target.value)}
                    placeholder="e.g. 7mK90pLmN82hQ..."
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#7856FF]"
                  />
                </div>

                {/* 4. New Admin Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Admin Full Name / Title
                  </label>
                  <input
                    type="text"
                    value={customNewAdminName}
                    onChange={(e) => setCustomNewAdminName(e.target.value)}
                    placeholder="e.g. Almaz Kebede (Finance Lead)"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#7856FF]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAssigningAdmin || !customNewAdminUid.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#7856FF] hover:bg-[#6340FF] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isAssigningAdmin ? 'Reassigning via Cloud Function...' : 'Authorize & Assign Ekub Admin'}</span>
                </button>
              </form>
            </div>

            {/* Right: Current Admin Info & Delegation History */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-[#F8F7FC] p-5 rounded-xl border border-[#E6E1F5] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Currently Assigned Admin</h3>
                {targetEkubObj ? (
                  <div className="bg-white p-4 rounded-xl border border-gray-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-sm">{targetEkubObj.adminName || 'Designated Admin'}</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">ACTIVE ADMIN</span>
                    </div>
                    <p className="text-gray-500 font-mono text-[11px]">UID: {targetEkubObj.adminId}</p>
                    <p className="text-gray-500">Ekub: <strong>{targetEkubObj.name}</strong></p>
                    <p className="text-gray-500">Created: {targetEkubObj.createdAt.split('T')[0]}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No Ekub selected.</p>
                )}
              </div>

              {/* Admin History Audit Trail */}
              <div className="bg-[#F8F7FC] p-5 rounded-xl border border-[#E6E1F5] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Admin Delegation History</h3>
                {targetEkubObj?.adminHistory && targetEkubObj.adminHistory.length > 0 ? (
                  <div className="space-y-2">
                    {targetEkubObj.adminHistory.map((hist, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">{hist.newAdminName || hist.newAdminId}</span>
                          <span className="text-gray-400 font-mono">{hist.assignedAt.split('T')[0]}</span>
                        </div>
                        <p className="text-gray-500">
                          Assigned by: <span className="font-mono text-gray-700">{hist.assignedBy}</span>
                        </p>
                        {hist.previousAdminId && (
                          <p className="text-gray-400">Previous Admin: <span className="font-mono">{hist.previousAdminId}</span></p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No previous reassignments recorded for this circle.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISPUTES & TICKETS */}
      {activeTab === 'disputes' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Member Dispute Resolution Desk
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Inquiries and dispute submissions regarding payment verification or turn eligibility.
          </p>

          {openTickets.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No open disputes filed.</p>
          ) : (
            <div className="space-y-3">
              {openTickets.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-[#F8F7FC] border border-[#E6E1F5]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">{t.subject}</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{t.description}</p>
                  <p className="text-[10px] text-gray-400 mt-2">
                    User: {t.userName} ({t.userEmail}) • Ref #{t.ticketId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: IMMUTABLE AUDIT LOGS */}
      {isSuperAdmin && activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-[#E6E1F5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Immutable System Audit Logs
              </h2>
              <p className="text-xs text-gray-500">
                Every sensitive financial action (draw execution, payment verification, payout disbursement, admin delegation) creates a permanent record.
              </p>
            </div>
          </div>

          {loadingAudit ? (
            <p className="text-xs text-gray-500 py-6 text-center">Loading audit records...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Entity ID</th>
                    <th className="py-2.5 px-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">
                        {log.timestamp.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7856FF]/10 text-[#7856FF]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">
                        {log.actorName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                        {log.entityId}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">
                        {log.reason || 'System operation executed.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* INSPECT RECEIPT MODAL */}
      {inspectReceipt && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectReceipt(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto p-6 shadow-2xl relative text-gray-900 my-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setInspectReceipt(null)}
              aria-label="Close modal"
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-1 text-[#1C1132]">Receipt Inspection</h3>
            <p className="text-xs text-gray-500 mb-4">{inspectReceipt.userName} • {inspectReceipt.amount.toLocaleString()} ETB ({inspectReceipt.paymentMethod.toUpperCase()})</p>
            
            <div className="rounded-xl overflow-hidden border border-gray-200 mb-4 bg-gray-100 max-h-80 flex items-center justify-center">
              <img
                src={inspectReceipt.receiptUrl}
                alt="Payment Receipt"
                className="w-full object-contain max-h-80"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-3 bg-[#F8F7FC] border border-[#E6E1F5] rounded-xl text-xs space-y-1 mb-4">
              <p>Transaction Ref: <strong className="font-mono text-gray-900">{inspectReceipt.transactionReference}</strong></p>
              <p>Ekub: <strong>{inspectReceipt.ekubName}</strong></p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setInspectReceipt(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleVerify(inspectReceipt);
                  setInspectReceipt(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT REASON MODAL */}
      {rejectingContribId && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRejectingContribId(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto p-6 shadow-2xl relative text-gray-900 my-auto animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold mb-2 text-[#1C1132]">Reject Payment Submission</h3>
            <p className="text-xs text-gray-600 mb-4">Please provide a reason so the member can correct and resubmit:</p>
            
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#7856FF] mb-4"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectingContribId(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = contributions.find(c => c.id === rejectingContribId);
                  if (target) handleReject(target);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSE PAYOUT MODAL */}
      {disbursingPayoutId && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDisbursingPayoutId(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto p-6 shadow-2xl relative text-gray-900 my-auto animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold mb-2 text-[#1C1132]">Authorize Wire Disbursement</h3>
            <p className="text-xs text-gray-600 mb-4">Enter the bank settlement or Telebirr payout confirmation reference number:</p>
            
            <input
              type="text"
              value={payoutBankRef}
              onChange={(e) => setPayoutBankRef(e.target.value)}
              placeholder="e.g. CBE-WIRE-9928174"
              className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#7856FF] mb-4"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDisbursingPayoutId(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = payouts.find(p => p.id === disbursingPayoutId);
                  if (target) handleDisbursePayout(target);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Confirm Disbursement
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
