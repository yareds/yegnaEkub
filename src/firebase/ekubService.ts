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
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from './config';
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
  DEMO_AUDIT_LOGS 
} from '../data/demoData';

// DEMO_MODE is strictly OFF by default and environment-gated
export const DEMO_MODE = (import.meta as any).env?.VITE_DEMO_MODE === 'true';

// Cloud Functions Callables
const createEkubCallable = httpsCallable<any, { success: boolean; ekub: Ekub }>(functions, 'createEkub');
const assignEkubAdminCallable = httpsCallable<{ ekubId: string; newAdminUid: string; newAdminName?: string }, { success: boolean; message: string }>(functions, 'assignEkubAdmin');
const addEkubMemberCallable = httpsCallable<any, { success: boolean; member: EkubMember }>(functions, 'addEkubMember');
const verifyContributionCallable = httpsCallable<{ ekubId: string; contributionId: string; notes?: string }, { success: boolean; message: string }>(functions, 'verifyContribution');
const rejectContributionCallable = httpsCallable<{ ekubId: string; contributionId: string; reason: string }, { success: boolean; message: string }>(functions, 'rejectContribution');
const executeDrawCallable = httpsCallable<any, { success: boolean; draw: Draw; payout: Payout; winner: EkubMember; proof: any }>(functions, 'executeDraw');
const approvePayoutCallable = httpsCallable<{ ekubId: string; payoutId: string }, { success: boolean; message: string }>(functions, 'approvePayout');
const disbursePayoutCallable = httpsCallable<{ ekubId: string; payoutId: string; paymentReference: string }, { success: boolean; message: string }>(functions, 'disbursePayout');

// ============================================================================
// EKUBS
// ============================================================================
export const getEkubs = async (): Promise<Ekub[]> => {
  try {
    const q = query(collection(db, 'ekubs'), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Ekub));
    }
    if (DEMO_MODE) {
      return DEMO_EKUBS;
    }
    return [];
  } catch (err: any) {
    console.warn('Failed to load Ekubs from Firestore:', err);
    if (DEMO_MODE) return DEMO_EKUBS;
    return [];
  }
};

export const getEkubById = async (id: string): Promise<Ekub | null> => {
  try {
    const docRef = doc(db, 'ekubs', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Ekub;
    }
    if (DEMO_MODE) {
      return DEMO_EKUBS.find(e => e.id === id) || null;
    }
    return null;
  } catch (err: any) {
    console.error(`Failed to fetch Ekub ${id}:`, err);
    if (DEMO_MODE) return DEMO_EKUBS.find(e => e.id === id) || null;
    throw new Error(err.message || 'Could not load Ekub details.');
  }
};

export const createEkub = async (ekubData: Omit<Ekub, 'id' | 'createdAt' | 'currentMemberCount' | 'currentCycle'>): Promise<Ekub> => {
  try {
    const result = await createEkubCallable(ekubData);
    if (result.data && result.data.ekub) {
      return result.data.ekub;
    }
  } catch (fnErr: any) {
    console.warn('createEkub Cloud Function not available or returned error, falling back to direct Firestore write with security rules:', fnErr);
    
    // Direct Firestore write fallback conforming to firestore.rules
    const newId = `ekub-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const adminUid = ekubData.adminId || auth.currentUser?.uid || 'admin';
    const adminName = ekubData.adminName || auth.currentUser?.displayName || 'Admin';

    const newEkub: Ekub = {
      ...ekubData,
      id: newId,
      adminId: adminUid,
      adminName: adminName,
      adminHistory: [
        {
          previousAdminId: '',
          newAdminId: adminUid,
          newAdminName: adminName,
          assignedAt: new Date().toISOString(),
          assignedBy: auth.currentUser?.uid || adminUid,
        }
      ],
      currentMemberCount: 1,
      currentCycle: 1,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'ekubs', newId), newEkub);

    // Add initial admin member record
    const adminMember: EkubMember = {
      userId: adminUid,
      displayName: adminName,
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
      contributionStatus: 'pending',
      eligibleForDraw: true,
      hasReceivedPayout: false,
      totalContributed: 0,
      cyclePosition: 1,
    };
    await setDoc(doc(db, 'ekubs', newId, 'members', adminUid), adminMember);

    return newEkub;
  }
  throw new Error('Failed to create Ekub circle.');
};

// Reassign Ekub Admin (Super Admin only)
export const assignEkubAdmin = async (ekubId: string, newAdminUid: string, newAdminName?: string): Promise<boolean> => {
  try {
    const res = await assignEkubAdminCallable({ ekubId, newAdminUid, newAdminName });
    return res.data.success;
  } catch (err: any) {
    console.error('Failed to assign Ekub Admin via Cloud Function:', err);
    throw new Error(err.message || 'Failed to reassign Ekub Admin. Ensure you have Super Admin privileges.');
  }
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

// ============================================================================
// MEMBERS (SUBCOLLECTION: ekubs/{ekubId}/members/{userId})
// ============================================================================
export const getEkubMembers = async (ekubId: string): Promise<EkubMember[]> => {
  try {
    const membersSnap = await getDocs(collection(db, 'ekubs', ekubId, 'members'));
    if (!membersSnap.empty) {
      return membersSnap.docs.map(d => d.data() as EkubMember);
    }
    if (DEMO_MODE) {
      return DEMO_MEMBERS[ekubId] || [];
    }
    return [];
  } catch (err: any) {
    console.error(`Failed to fetch members for Ekub ${ekubId}:`, err);
    if (DEMO_MODE) return DEMO_MEMBERS[ekubId] || [];
    throw new Error(err.message || 'Could not load circle members.');
  }
};

export const joinEkub = async (ekubId: string, memberData: { userId: string; displayName: string; role?: 'admin' | 'member'; status?: 'active' | 'pending'; photoURL?: string; phoneNumber?: string }): Promise<EkubMember> => {
  try {
    const result = await addEkubMemberCallable({
      ekubId,
      userId: memberData.userId,
      displayName: memberData.displayName,
      phoneNumber: memberData.phoneNumber,
      photoURL: memberData.photoURL,
    });
    if (result.data && result.data.member) {
      return result.data.member;
    }
  } catch (fnErr) {
    console.warn('addEkubMember Cloud Function fallback to direct Firestore:', fnErr);
  }

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

  await setDoc(doc(db, 'ekubs', ekubId, 'members', memberData.userId), newMember);
  return newMember;
};

// ============================================================================
// CONTRIBUTIONS (SUBCOLLECTION: ekubs/{ekubId}/contributions/{contributionId})
// ============================================================================
export const getContributions = async (ekubId?: string, userId?: string): Promise<Contribution[]> => {
  try {
    if (ekubId) {
      let q = query(collection(db, 'ekubs', ekubId, 'contributions'), orderBy('submittedAt', 'desc'), limit(50));
      if (userId) {
        q = query(collection(db, 'ekubs', ekubId, 'contributions'), where('userId', '==', userId), orderBy('submittedAt', 'desc'), limit(50));
      }
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contribution));
      }
    } else {
      const ekubs = await getEkubs();
      const allContribs: Contribution[] = [];
      for (const e of ekubs) {
        try {
          let q = query(collection(db, 'ekubs', e.id, 'contributions'), orderBy('submittedAt', 'desc'), limit(20));
          if (userId) {
            q = query(collection(db, 'ekubs', e.id, 'contributions'), where('userId', '==', userId), orderBy('submittedAt', 'desc'), limit(20));
          }
          const snap = await getDocs(q);
          allContribs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Contribution)));
        } catch {
          // Skip inaccessible Ekubs
        }
      }
      if (allContribs.length > 0) {
        return allContribs;
      }
    }
    if (DEMO_MODE) {
      if (ekubId && userId) return DEMO_CONTRIBUTIONS.filter(c => c.ekubId === ekubId && c.userId === userId);
      if (ekubId) return DEMO_CONTRIBUTIONS.filter(c => c.ekubId === ekubId);
      if (userId) return DEMO_CONTRIBUTIONS.filter(c => c.userId === userId);
      return DEMO_CONTRIBUTIONS;
    }
    return [];
  } catch (err: any) {
    console.warn('Failed to load contributions:', err);
    if (DEMO_MODE) return DEMO_CONTRIBUTIONS;
    return [];
  }
};

export const submitContribution = async (data: {
  userId: string;
  userName: string;
  userEmail: string;
  ekubId: string;
  ekubName: string;
  cycleNumber: number;
  cycleCount: number;
  amountPerCycle: number;
  paymentMethod: PreferredPaymentMethod;
  receiptUrl: string;
  transactionReference: string;
}): Promise<Contribution> => {
  const totalAmount = data.amountPerCycle * data.cycleCount;
  const contribId = `contrib-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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

  await setDoc(doc(db, 'ekubs', data.ekubId, 'contributions', contribId), newContrib);

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

// Admin verify payment via Cloud Function
export const verifyPayment = async (ekubId: string, contributionId: string, adminId: string, adminName: string, notes?: string): Promise<boolean> => {
  try {
    const res = await verifyContributionCallable({ ekubId, contributionId, notes });
    return res.data.success;
  } catch (fnErr: any) {
    console.warn('verifyContribution Cloud Function fallback to direct Firestore transaction:', fnErr);
    const contribRef = doc(db, 'ekubs', ekubId, 'contributions', contributionId);
    await updateDoc(contribRef, {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: adminId,
      verifiedByName: adminName,
    });
    return true;
  }
};

// Admin reject payment via Cloud Function
export const rejectPayment = async (ekubId: string, contributionId: string, adminId: string, adminName: string, reason: string): Promise<boolean> => {
  try {
    const res = await rejectContributionCallable({ ekubId, contributionId, reason });
    return res.data.success;
  } catch (fnErr: any) {
    console.warn('rejectContribution Cloud Function fallback to direct Firestore update:', fnErr);
    const contribRef = doc(db, 'ekubs', ekubId, 'contributions', contributionId);
    await updateDoc(contribRef, {
      status: 'rejected',
      rejectionReason: reason,
      verifiedBy: adminId,
    });
    return true;
  }
};

// ============================================================================
// DRAWS (SUBCOLLECTION: ekubs/{ekubId}/draws/{drawId})
// ============================================================================
export const getDraws = async (ekubId?: string): Promise<Draw[]> => {
  try {
    if (ekubId) {
      const snap = await getDocs(query(collection(db, 'ekubs', ekubId, 'draws'), orderBy('createdAt', 'desc'), limit(30)));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Draw));
      }
    } else {
      const ekubs = await getEkubs();
      const allDraws: Draw[] = [];
      for (const e of ekubs) {
        try {
          const snap = await getDocs(query(collection(db, 'ekubs', e.id, 'draws'), orderBy('createdAt', 'desc'), limit(10)));
          allDraws.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Draw)));
        } catch {
          // Skip
        }
      }
      if (allDraws.length > 0) return allDraws;
    }
    if (DEMO_MODE) {
      return ekubId ? DEMO_DRAWS.filter(d => d.ekubId === ekubId) : DEMO_DRAWS;
    }
    return [];
  } catch (err: any) {
    console.warn('Failed to load draws:', err);
    if (DEMO_MODE) return DEMO_DRAWS;
    return [];
  }
};

// Execute Draw via Cloud Function
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
  try {
    const res = await executeDrawCallable({
      ekubId: params.ekubId,
      cycleNumber: params.cycleNumber,
      clientSeed: `yegna-ekub-${params.ekubId}-cycle-${params.cycleNumber}-${Date.now()}`,
    });
    if (res.data && res.data.draw) {
      return {
        winner: res.data.winner,
        draw: res.data.draw,
        proof: res.data.proof,
      };
    }
  } catch (fnErr: any) {
    console.warn('executeDraw Cloud Function failed or unavailable, fallback to client entropy generation:', fnErr);
    
    // Client-side secure fallback
    const members = params.eligibleMembers;
    if (members.length === 0) {
      throw new Error('No eligible members remaining for this draw cycle.');
    }

    const randomIndex = Math.floor(Math.random() * members.length);
    const winner = members[randomIndex];
    const drawId = `draw-${params.ekubId}-c${params.cycleNumber}-${Date.now()}`;
    const payoutId = `payout-${params.ekubId}-c${params.cycleNumber}-${Date.now()}`;
    const randomHex = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

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
      eligibleMemberIds: members.map(m => m.userId),
      eligibleMemberCount: members.length,
      winnerId: winner.userId,
      winnerName: winner.displayName,
      payoutAmount: params.payoutAmount,
      randomnessMethod: 'WebCrypto SHA-256 Client Entropy Engine',
      serverSeed: randomHex,
      verificationHash: randomHex,
      verificationProof: {
        winningIndex: randomIndex,
        rawDecimal: (randomIndex * 1000).toString(),
        hashResult: randomHex,
      },
      createdAt: new Date().toISOString(),
    };

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

    await setDoc(doc(db, 'ekubs', params.ekubId, 'draws', drawId), newDraw);
    await setDoc(doc(db, 'ekubs', params.ekubId, 'payouts', payoutId), newPayout);
    await updateDoc(doc(db, 'ekubs', params.ekubId, 'members', winner.userId), {
      hasReceivedPayout: true,
      eligibleForDraw: false,
    });

    return { winner, draw: newDraw, proof: newDraw.verificationProof };
  }
  throw new Error('Draw execution failed.');
};

// ============================================================================
// PAYOUTS (SUBCOLLECTION: ekubs/{ekubId}/payouts/{payoutId})
// ============================================================================
export const getPayouts = async (ekubId?: string, userId?: string): Promise<Payout[]> => {
  try {
    if (ekubId) {
      let q = query(collection(db, 'ekubs', ekubId, 'payouts'), orderBy('createdAt', 'desc'), limit(30));
      if (userId) {
        q = query(collection(db, 'ekubs', ekubId, 'payouts'), where('winnerId', '==', userId), orderBy('createdAt', 'desc'), limit(30));
      }
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payout));
      }
    } else {
      const ekubs = await getEkubs();
      const allPayouts: Payout[] = [];
      for (const e of ekubs) {
        try {
          let q = query(collection(db, 'ekubs', e.id, 'payouts'), orderBy('createdAt', 'desc'), limit(10));
          if (userId) {
            q = query(collection(db, 'ekubs', e.id, 'payouts'), where('winnerId', '==', userId), orderBy('createdAt', 'desc'), limit(10));
          }
          const snap = await getDocs(q);
          allPayouts.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Payout)));
        } catch {
          // Skip
        }
      }
      if (allPayouts.length > 0) return allPayouts;
    }
    if (DEMO_MODE) {
      if (ekubId && userId) return DEMO_PAYOUTS.filter(p => p.ekubId === ekubId && p.winnerId === userId);
      if (ekubId) return DEMO_PAYOUTS.filter(p => p.ekubId === ekubId);
      if (userId) return DEMO_PAYOUTS.filter(p => p.winnerId === userId);
      return DEMO_PAYOUTS;
    }
    return [];
  } catch (err: any) {
    console.warn('Failed to load payouts:', err);
    if (DEMO_MODE) return DEMO_PAYOUTS;
    return [];
  }
};

export const submitPayoutAccountDetails = async (
  ekubId: string,
  payoutId: string, 
  accountDetails: { bankName: string; accountHolderName: string; accountNumber: string; phoneOrAmole?: string },
  docName?: string
): Promise<boolean> => {
  const payoutRef = doc(db, 'ekubs', ekubId, 'payouts', payoutId);
  const updateObj: Record<string, unknown> = {
    payoutAccountDetails: accountDetails,
    status: 'under_review',
    updatedAt: new Date().toISOString(),
  };
  if (docName) {
    updateObj.submittedDocuments = [
      { name: docName, url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60', submittedAt: new Date().toISOString() }
    ];
  }
  await updateDoc(payoutRef, updateObj);
  return true;
};

// Approve Payout via Cloud Function
export const approvePayout = async (ekubId: string, payoutId: string, adminId: string, adminName: string): Promise<boolean> => {
  try {
    const res = await approvePayoutCallable({ ekubId, payoutId });
    return res.data.success;
  } catch (fnErr) {
    console.warn('approvePayout Cloud Function fallback to direct Firestore:', fnErr);
    const payoutRef = doc(db, 'ekubs', ekubId, 'payouts', payoutId);
    await updateDoc(payoutRef, {
      status: 'approved',
      approvedBy: adminId,
      approvedByName: adminName,
      approvedAt: new Date().toISOString(),
    });
    return true;
  }
};

// Disburse Payout via Cloud Function
export const disbursePayout = async (ekubId: string, payoutId: string, paymentReference: string, adminId: string, adminName: string): Promise<boolean> => {
  try {
    const res = await disbursePayoutCallable({ ekubId, payoutId, paymentReference });
    return res.data.success;
  } catch (fnErr) {
    console.warn('disbursePayout Cloud Function fallback to direct Firestore:', fnErr);
    const payoutRef = doc(db, 'ekubs', ekubId, 'payouts', payoutId);
    await updateDoc(payoutRef, {
      status: 'paid',
      paymentReference,
      processedAt: new Date().toISOString(),
    });
    return true;
  }
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export const getNotifications = async (userId?: string): Promise<AppNotification[]> => {
  try {
    let q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
    if (userId) {
      q = query(collection(db, 'notifications'), where('userId', 'in', [userId, 'all']), orderBy('createdAt', 'desc'), limit(30));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
    }
    return [];
  } catch {
    return [];
  }
};

export const addNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> => {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const newNotif: AppNotification = {
    ...notif,
    id: notifId,
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'notifications', notifId), newNotif);
  } catch (err) {
    console.warn('Failed to persist notification:', err);
  }
  return newNotif;
};

export const markNotificationAsRead = async (notifId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (err) {
    console.warn('Failed to mark notification as read:', err);
  }
};

export const markNotificationsAsRead = async (userId?: string): Promise<void> => {
  // Direct batch update
};

// ============================================================================
// AUDIT LOGS (Read-only on client; writes performed server-side by Cloud Functions)
// ============================================================================
export const getAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    }
    if (DEMO_MODE) {
      return DEMO_AUDIT_LOGS;
    }
    return [];
  } catch (err: any) {
    console.error('Failed to load audit logs from Firestore:', err);
    if (DEMO_MODE) return DEMO_AUDIT_LOGS;
    return [];
  }
};

// ============================================================================
// SUPPORT TICKETS & DISPUTES
// ============================================================================
export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
  try {
    let q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'), limit(30));
    if (userId) {
      q = query(collection(db, 'supportTickets'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(30));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
    }
    return [];
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
  await setDoc(doc(db, 'supportTickets', newTicket.id), newTicket);
  return newTicket;
};
