import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './config';
import { 
  Ekub, 
  EkubMember, 
  Contribution, 
  Draw, 
  Payout, 
  AppNotification, 
  AuditLog, 
  SupportTicket,
  PreferredPaymentMethod
} from '../types';
import { 
  DEMO_EKUBS, 
  DEMO_MEMBERS, 
  DEMO_CONTRIBUTIONS, 
  DEMO_DRAWS, 
  DEMO_PAYOUTS, 
  DEMO_NOTIFICATIONS, 
  DEMO_AUDIT_LOGS 
} from '../data/demoData';

// Local storage caching keys to enable reliable offline/local testing and real persistence
const STORAGE_KEYS = {
  EKUBS: 'yegna_ekubs_store',
  MEMBERS: 'yegna_members_store',
  CONTRIBUTIONS: 'yegna_contributions_store',
  DRAWS: 'yegna_draws_store',
  PAYOUTS: 'yegna_payouts_store',
  NOTIFICATIONS: 'yegna_notifications_store',
  AUDIT_LOGS: 'yegna_audit_logs_store',
  TICKETS: 'yegna_tickets_store',
};

// Initialize local cache with demo data if empty
export const initializeDataStore = () => {
  if (!localStorage.getItem(STORAGE_KEYS.EKUBS)) {
    localStorage.setItem(STORAGE_KEYS.EKUBS, JSON.stringify(DEMO_EKUBS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.MEMBERS)) {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(DEMO_MEMBERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS)) {
    localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(DEMO_CONTRIBUTIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DRAWS)) {
    localStorage.setItem(STORAGE_KEYS.DRAWS, JSON.stringify(DEMO_DRAWS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PAYOUTS)) {
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(DEMO_PAYOUTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(DEMO_NOTIFICATIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEMO_AUDIT_LOGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TICKETS)) {
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
  }
};

initializeDataStore();

// Reset/Reload Demo Data
export const resetDemoData = () => {
  localStorage.setItem(STORAGE_KEYS.EKUBS, JSON.stringify(DEMO_EKUBS));
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(DEMO_MEMBERS));
  localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(DEMO_CONTRIBUTIONS));
  localStorage.setItem(STORAGE_KEYS.DRAWS, JSON.stringify(DEMO_DRAWS));
  localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(DEMO_PAYOUTS));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(DEMO_NOTIFICATIONS));
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEMO_AUDIT_LOGS));
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify([]));
};

// --- EKUBS ---
export const getEkubs = async (): Promise<Ekub[]> => {
  try {
    const q = query(collection(db, 'ekubs'), orderBy('createdAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ekub));
    }
  } catch (err) {
    console.warn('Firestore fetch fallback to store:', err);
  }
  const cached = localStorage.getItem(STORAGE_KEYS.EKUBS);
  return cached ? JSON.parse(cached) : DEMO_EKUBS;
};

export const getEkubById = async (id: string): Promise<Ekub | null> => {
  try {
    const docRef = doc(db, 'ekubs', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Ekub;
    }
  } catch (err) {
    console.warn('Firestore single fetch fallback:', err);
  }
  const list = await getEkubs();
  return list.find(e => e.id === id) || null;
};

export const createEkub = async (ekubData: Omit<Ekub, 'id' | 'createdAt' | 'currentMemberCount' | 'currentCycle'>): Promise<Ekub> => {
  const newId = `ekub-${Date.now()}`;
  const newEkub: Ekub = {
    ...ekubData,
    id: newId,
    currentMemberCount: 1,
    currentCycle: 1,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'ekubs', newId), newEkub);
  } catch (err) {
    console.warn('Firestore create fallback:', err);
  }

  // Update local cache
  const cached = localStorage.getItem(STORAGE_KEYS.EKUBS);
  const list: Ekub[] = cached ? JSON.parse(cached) : [];
  list.unshift(newEkub);
  localStorage.setItem(STORAGE_KEYS.EKUBS, JSON.stringify(list));

  // Add creator as member
  await joinEkub(newId, {
    userId: newEkub.organizerId,
    displayName: newEkub.organizerName,
    role: 'organizer',
    status: 'active',
  });

  return newEkub;
};

export const joinEkubWithInviteCode = async (inviteCode: string, userId: string, displayName: string, userEmail: string): Promise<Ekub> => {
  const list = await getEkubs();
  const found = list.find(e => e.inviteCode?.toUpperCase() === inviteCode.toUpperCase() || e.id === inviteCode);
  if (!found) {
    throw new Error('Invalid or expired Ekub invite code.');
  }

  await joinEkub(found.id, {
    userId,
    displayName,
    role: 'member',
    status: 'active',
  });

  return found;
};

// --- MEMBERS ---
export const getEkubMembers = async (ekubId: string): Promise<EkubMember[]> => {
  try {
    const membersSnap = await getDocs(collection(db, 'ekubs', ekubId, 'members'));
    if (!membersSnap.empty) {
      return membersSnap.docs.map(d => d.data() as EkubMember);
    }
  } catch (err) {
    console.warn('Firestore members fetch fallback:', err);
  }
  const allMembersCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '{}');
  return allMembersCache[ekubId] || DEMO_MEMBERS[ekubId] || [];
};

export const joinEkub = async (ekubId: string, memberData: { userId: string; displayName: string; role?: 'member' | 'organizer'; status?: 'active' | 'pending'; photoURL?: string; phoneNumber?: string }): Promise<EkubMember> => {
  const newMember: EkubMember = {
    userId: memberData.userId,
    displayName: memberData.displayName,
    role: memberData.role || 'member',
    status: memberData.status || 'active',
    joinedAt: new Date().toISOString(),
    contributionStatus: 'pending',
    eligibleForDraw: true,
    hasReceivedPayout: false,
    totalContributed: 0,
    cyclePosition: 1,
    photoURL: memberData.photoURL,
    phoneNumber: memberData.phoneNumber,
  };

  try {
    await setDoc(doc(db, 'ekubs', ekubId, 'members', memberData.userId), newMember);
  } catch (err) {
    console.warn('Firestore join member fallback:', err);
  }

  // Update local cache
  const allMembersCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '{}');
  const ekubMembers: EkubMember[] = allMembersCache[ekubId] || [];
  newMember.cyclePosition = ekubMembers.length + 1;
  ekubMembers.push(newMember);
  allMembersCache[ekubId] = ekubMembers;
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(allMembersCache));

  return newMember;
};

// --- CONTRIBUTIONS ---
export const getContributions = async (userId?: string, ekubId?: string): Promise<Contribution[]> => {
  try {
    let q = query(collection(db, 'contributions'), orderBy('submittedAt', 'desc'), limit(50));
    if (userId) {
      q = query(collection(db, 'contributions'), where('userId', '==', userId), orderBy('submittedAt', 'desc'), limit(50));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contribution));
    }
  } catch (err) {
    console.warn('Firestore contributions fallback:', err);
  }
  const cached: Contribution[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS) || '[]');
  if (ekubId && userId) {
    return cached.filter(c => c.ekubId === ekubId && c.userId === userId);
  } else if (ekubId) {
    return cached.filter(c => c.ekubId === ekubId);
  } else if (userId) {
    return cached.filter(c => c.userId === userId);
  }
  return cached;
};

export const submitContribution = async (data: {
  userId: string;
  userName: string;
  userEmail: string;
  ekubId: string;
  ekubName: string;
  cycleNumber: number;
  cycleCount: number; // 1, 2, or 3 cycles
  amountPerCycle: number;
  paymentMethod: PreferredPaymentMethod;
  receiptUrl: string;
  transactionReference: string;
}): Promise<Contribution> => {
  const totalAmount = data.amountPerCycle * data.cycleCount;
  const contribId = `contrib-${Date.now()}`;
  const newContrib: Contribution = {
    id: contribId,
    userId: data.userId,
    userName: data.userName,
    userEmail: data.userEmail,
    ekubId: data.ekubId,
    ekubName: data.ekubName,
    cycleId: `cycle-${data.cycleNumber}`,
    cycleNumber: data.cycleNumber,
    amount: totalAmount,
    currency: 'ETB',
    paymentMethod: data.paymentMethod,
    receiptUrl: data.receiptUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
    transactionReference: data.transactionReference,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    notes: data.cycleCount > 1 ? `Multi-cycle payment: Paid ${data.cycleCount} cycles in advance.` : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'contributions', contribId), newContrib);
  } catch (err) {
    console.warn('Firestore submit contribution fallback:', err);
  }

  // Update local cache
  const cached: Contribution[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS) || '[]');
  cached.unshift(newContrib);
  localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(cached));

  // Add in-app notification
  await addNotification({
    userId: data.userId,
    title: 'Contribution Submitted for Verification',
    message: `Your ${totalAmount.toLocaleString()} ETB payment via ${data.paymentMethod.toUpperCase()} (Ref: ${data.transactionReference}) is currently pending admin audit.`,
    type: 'payment_submitted',
    read: false,
    link: '/contributions',
  });

  return newContrib;
};

// Admin verify payment
export const verifyPayment = async (contributionId: string, adminId: string, adminName: string): Promise<boolean> => {
  try {
    // Call server endpoint
    await fetch('/api/admin/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contributionId, adminId, adminName }),
    });
  } catch (err) {
    console.warn('Server verify payment endpoint fallback:', err);
  }

  // Update local cache
  const cached: Contribution[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS) || '[]');
  const index = cached.findIndex(c => c.id === contributionId);
  if (index !== -1) {
    cached[index].status = 'verified';
    cached[index].verifiedAt = new Date().toISOString();
    cached[index].verifiedBy = adminId;
    cached[index].verifiedByName = adminName;
    localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(cached));

    // Update member eligibility
    const allMembersCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '{}');
    const ekubMembers: EkubMember[] = allMembersCache[cached[index].ekubId] || [];
    const memberIdx = ekubMembers.findIndex(m => m.userId === cached[index].userId);
    if (memberIdx !== -1) {
      ekubMembers[memberIdx].contributionStatus = 'paid';
      ekubMembers[memberIdx].totalContributed += cached[index].amount;
      ekubMembers[memberIdx].lastContributionDate = new Date().toISOString().split('T')[0];
      if (!ekubMembers[memberIdx].hasReceivedPayout) {
        ekubMembers[memberIdx].eligibleForDraw = true;
      }
      allMembersCache[cached[index].ekubId] = ekubMembers;
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(allMembersCache));
    }

    // Add notification
    await addNotification({
      userId: cached[index].userId,
      title: 'Payment Verified ✓',
      message: `Your payment of ${cached[index].amount.toLocaleString()} ETB for ${cached[index].ekubName} is approved! You are eligible for the next draw.`,
      type: 'payment_verified',
      read: false,
      link: '/contributions',
    });
  }

  return true;
};

// Admin reject payment
export const rejectPayment = async (contributionId: string, adminId: string, adminName: string, reason: string): Promise<boolean> => {
  try {
    await fetch('/api/admin/reject-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contributionId, adminId, adminName, rejectionReason: reason }),
    });
  } catch (err) {
    console.warn('Server reject payment fallback:', err);
  }

  const cached: Contribution[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS) || '[]');
  const index = cached.findIndex(c => c.id === contributionId);
  if (index !== -1) {
    cached[index].status = 'rejected';
    cached[index].rejectionReason = reason;
    localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(cached));

    await addNotification({
      userId: cached[index].userId,
      title: 'Payment Submission Rejected ✕',
      message: `Your payment for ${cached[index].ekubName} could not be verified: "${reason}". Please resubmit or open a dispute.`,
      type: 'payment_rejected',
      read: false,
      link: '/contributions',
    });
  }
  return true;
};

// --- DRAWS & PROVABLY FAIR ENGINE ---
export const getDraws = async (ekubId?: string): Promise<Draw[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'draws'), orderBy('createdAt', 'desc'), limit(30)));
    if (!snap.empty) {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Draw));
      return ekubId ? items.filter(d => d.ekubId === ekubId) : items;
    }
  } catch (err) {
    console.warn('Firestore draws fallback:', err);
  }
  const cached: Draw[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAWS) || '[]');
  return ekubId ? cached.filter(d => d.ekubId === ekubId) : cached;
};

export const executeDraw = async (params: {
  ekubId: string;
  ekubName: string;
  cycleId: string;
  cycleNumber: number;
  eligibleMembers: EkubMember[];
  payoutAmount: number;
  actorId: string;
  actorName: string;
}): Promise<{ winner: EkubMember; draw: Draw; proof: any }> => {
  // Call trusted server cryptographic execution endpoint
  const res = await fetch('/api/draws/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to execute draw.');
  }

  const result = await res.json();
  const { winner, proof, drawId, payoutId } = result;

  const newDraw: Draw = {
    id: drawId,
    ekubId: params.ekubId,
    ekubName: params.ekubName,
    cycleId: params.cycleId,
    cycleNumber: params.cycleNumber,
    drawNumber: params.cycleNumber,
    status: 'completed',
    scheduledAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    eligibleMemberIds: params.eligibleMembers.map(m => m.userId),
    eligibleMemberCount: params.eligibleMembers.length,
    winnerId: winner.userId,
    winnerName: winner.displayName,
    payoutAmount: params.payoutAmount,
    randomnessMethod: 'HMAC-SHA256 Server Seed + Nonce Cryptographic Entropy',
    serverSeed: proof.serverSeed,
    serverSeedHash: proof.serverSeedHash,
    clientSeed: proof.clientSeed,
    nonce: proof.nonce,
    verificationHash: proof.hashResult,
    verificationProof: {
      combinedEntropy: `${proof.clientSeed}:${proof.nonce}:${params.cycleNumber}`,
      hashResult: proof.hashResult,
      rawDecimal: proof.rawDecimal,
      winningIndex: proof.winningIndex,
      explanation: proof.explanation,
    },
    createdAt: new Date().toISOString(),
  };

  // Update local caches
  const drawsCache: Draw[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAWS) || '[]');
  drawsCache.unshift(newDraw);
  localStorage.setItem(STORAGE_KEYS.DRAWS, JSON.stringify(drawsCache));

  // Update member state: Winner can no longer participate in remaining draws
  const allMembersCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMBERS) || '{}');
  const ekubMembers: EkubMember[] = allMembersCache[params.ekubId] || [];
  const winningMemberIdx = ekubMembers.findIndex(m => m.userId === winner.userId);
  if (winningMemberIdx !== -1) {
    ekubMembers[winningMemberIdx].hasReceivedPayout = true;
    ekubMembers[winningMemberIdx].eligibleForDraw = false;
    ekubMembers[winningMemberIdx].payoutCycle = params.cycleNumber;
    allMembersCache[params.ekubId] = ekubMembers;
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(allMembersCache));
  }

  // Create Payout Record
  const newPayout: Payout = {
    id: payoutId,
    ekubId: params.ekubId,
    ekubName: params.ekubName,
    cycleId: params.cycleId,
    cycleNumber: params.cycleNumber,
    drawId: drawId,
    winnerId: winner.userId,
    winnerName: winner.displayName,
    amount: params.payoutAmount,
    currency: 'ETB',
    status: 'documents_required',
    requiredDocuments: ['National ID / Kebele ID', 'Bank Account / Telebirr Confirmation'],
    createdAt: new Date().toISOString(),
  };
  const payoutsCache: Payout[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
  payoutsCache.unshift(newPayout);
  localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(payoutsCache));

  // Broadcast winner notification to all members
  await addNotification({
    userId: winner.userId,
    title: '🎉 You Won the Ekub Draw!',
    message: `Congratulations! You won the Cycle #${params.cycleNumber} payout of ${params.payoutAmount.toLocaleString()} ETB in ${params.ekubName}! Please submit your bank details to receive funds.`,
    type: 'winner_announcement',
    read: false,
    link: '/payouts',
  });

  return { winner, draw: newDraw, proof };
};

// --- PAYOUTS ---
export const getPayouts = async (userId?: string): Promise<Payout[]> => {
  const cached: Payout[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
  return userId ? cached.filter(p => p.winnerId === userId) : cached;
};

export const submitPayoutAccountDetails = async (
  payoutId: string, 
  accountDetails: { bankName: string; accountHolderName: string; accountNumber: string; phoneOrAmole?: string },
  docName?: string
): Promise<boolean> => {
  const cached: Payout[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
  const idx = cached.findIndex(p => p.id === payoutId);
  if (idx !== -1) {
    cached[idx].payoutAccountDetails = accountDetails;
    cached[idx].status = 'under_review';
    if (docName) {
      cached[idx].submittedDocuments = [
        { name: docName, url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60', submittedAt: new Date().toISOString() }
      ];
    }
    cached[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(cached));
  }
  return true;
};

export const approvePayout = async (payoutId: string, adminId: string, adminName: string): Promise<boolean> => {
  const cached: Payout[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
  const idx = cached.findIndex(p => p.id === payoutId);
  if (idx !== -1) {
    cached[idx].status = 'approved';
    cached[idx].approvedBy = adminId;
    cached[idx].approvedByName = adminName;
    cached[idx].approvedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(cached));

    await addNotification({
      userId: cached[idx].winnerId,
      title: 'Payout Approved ✓',
      message: `Your ${cached[idx].amount.toLocaleString()} ETB payout claim is approved and queued for bank wire transfer.`,
      type: 'payout_approval',
      read: false,
      link: '/payouts',
    });
  }
  return true;
};

export const disbursePayout = async (payoutId: string, paymentReference: string, adminId: string, adminName: string): Promise<boolean> => {
  try {
    await fetch('/api/payouts/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutId, paymentReference, adminId, adminName }),
    });
  } catch (err) {
    console.warn('Server disburse payout fallback:', err);
  }

  const cached: Payout[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYOUTS) || '[]');
  const idx = cached.findIndex(p => p.id === payoutId);
  if (idx !== -1) {
    cached[idx].status = 'paid';
    cached[idx].paymentReference = paymentReference;
    cached[idx].processedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.PAYOUTS, JSON.stringify(cached));

    await addNotification({
      userId: cached[idx].winnerId,
      title: 'Payout Transferred to Your Bank Account 💰',
      message: `Your ${cached[idx].amount.toLocaleString()} ETB payout has been disbursed with reference ${paymentReference}.`,
      type: 'payout_completed',
      read: false,
      link: '/payouts',
    });
  }
  return true;
};

// --- NOTIFICATIONS ---
export const getNotifications = async (userId?: string): Promise<AppNotification[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const cached: AppNotification[] = raw ? JSON.parse(raw) : DEMO_NOTIFICATIONS;
    const list = Array.isArray(cached) ? cached : DEMO_NOTIFICATIONS;
    if (!userId) return list;
    return list.filter(n => n.userId === userId || n.userId === 'all');
  } catch {
    return DEMO_NOTIFICATIONS;
  }
};

export const addNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> => {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const cached: AppNotification[] = raw ? JSON.parse(raw) : DEMO_NOTIFICATIONS;
    const list = Array.isArray(cached) ? cached : [];
    list.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  } catch (err) {
    console.warn('Notification save error:', err);
  }
  return newNotif;
};

export const markNotificationAsRead = async (notifId: string): Promise<void> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const cached: AppNotification[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(cached) ? cached : [];
    const updated = list.map(n => n.id === notifId ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  } catch (err) {
    console.warn('markNotificationAsRead error:', err);
  }
};

export const markNotificationsAsRead = async (userId?: string): Promise<void> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const cached: AppNotification[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(cached) ? cached : [];
    const updated = list.map(n => (!userId || n.userId === userId || n.userId === 'all') ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
  } catch (err) {
    console.warn('markNotificationsAsRead error:', err);
  }
};

// --- AUDIT LOGS ---
export const getAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const res = await fetch('/api/audit-logs');
    if (res.ok) {
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn('Server audit logs fetch fallback:', err);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    const cached = raw ? JSON.parse(raw) : DEMO_AUDIT_LOGS;
    return Array.isArray(cached) ? cached : DEMO_AUDIT_LOGS;
  } catch {
    return DEMO_AUDIT_LOGS;
  }
};

// --- SUPPORT TICKETS & DISPUTES ---
export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TICKETS);
    const cached: SupportTicket[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(cached) ? cached : [];
    return userId ? list.filter(t => t.userId === userId) : list;
  } catch {
    return [];
  }
};

export const createSupportTicket = async (ticketData: Omit<SupportTicket, 'id' | 'ticketId' | 'status' | 'createdAt'>): Promise<SupportTicket> => {
  const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
  const newTicket: SupportTicket = {
    ...ticketData,
    id: `ticket-${Date.now()}`,
    ticketId,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const cached: SupportTicket[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TICKETS) || '[]');
  cached.unshift(newTicket);
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(cached));
  return newTicket;
};
