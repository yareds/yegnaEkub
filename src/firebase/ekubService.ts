import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  increment,
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
  PreferredPaymentMethod,
  UserProfile
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
const approveMembershipRequestCallable = httpsCallable<{ ekubId: string; userId: string }, { success: boolean; message: string }>(functions, 'approveMembershipRequest');
const removeEkubMemberCallable = httpsCallable<{ ekubId: string; userId: string }, { success: boolean; message: string }>(functions, 'removeEkubMember');
const inviteMemberCallable = httpsCallable<{ email: string; fullName: string; phoneNumber?: string }, { success: boolean; uid: string; resetLink: string; alreadyExisted?: boolean }>(functions, 'inviteMember');

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

/**
 * Create a new Ekub (Super Admin only).
 *
 * NOTE: This action is executed EXCLUSIVELY via the `createEkub` Cloud Function.
 * Direct Firestore write fallback is strictly forbidden because the Cloud Function
 * enforces critical business-logic checks (such as preventing the Super Admin from
 * assigning themselves as an Ekub's Admin), handles atomic membership initialization,
 * and maintains audit log integrity that client Firestore rules cannot enforce alone.
 */
export const createEkub = async (ekubData: Omit<Ekub, 'id' | 'createdAt' | 'currentMemberCount' | 'currentCycle'>): Promise<Ekub> => {
  try {
    const result = await createEkubCallable(ekubData);
    if (result.data?.ekub) {
      return result.data.ekub;
    }
    throw new Error('Failed to create Ekub.');
  } catch (err: any) {
    console.error('createEkub failed:', err);
    throw new Error(err?.message || 'Failed to create Ekub.');
  }
};

/**
 * Reassign Ekub Admin (Super Admin only).
 *
 * NOTE: This action is executed EXCLUSIVELY via the `assignEkubAdmin` Cloud Function.
 * Direct Firestore write fallback is strictly forbidden because the Cloud Function
 * enforces critical business-logic checks (including preventing self-assignment by
 * Super Admin), updates the previous and new admin member records atomically in a
 * transaction, and writes server-authoritative audit logs.
 */
export const assignEkubAdmin = async (ekubId: string, newAdminUid: string, newAdminName?: string): Promise<boolean> => {
  try {
    const res = await assignEkubAdminCallable({ ekubId, newAdminUid, newAdminName });
    if (res.data?.success) {
      return true;
    }
    throw new Error('Failed to reassign Ekub Admin.');
  } catch (err: any) {
    console.error('assignEkubAdmin failed:', err);
    throw new Error(err?.message || 'Failed to reassign Ekub Admin.');
  }
};

export const joinEkubWithInviteCode = async (inviteCode: string, userId: string, displayName: string, userEmail: string): Promise<Ekub> => {
  const list = await getEkubs();
  const found = list.find(e => e.inviteCode?.toUpperCase() === inviteCode.toUpperCase() || e.id === inviteCode);
  if (!found) {
    throw new Error('Invalid or expired Ekub invite code.');
  }

  await requestToJoinEkub(found.id, {
    userId,
    displayName,
    userEmail,
  });

  return found;
};

// A prospective member requests to join by writing their OWN member doc
// directly, with status: 'pending' -- this is a self-write permitted by
// firestore.rules specifically for this shape (pending, role: member, not
// yet draw-eligible). It does NOT make them an active member; an Ekub
// Admin or Super Admin must call approveMembershipRequest() to accept it.
// This replaces the old joinEkub() flow, which incorrectly routed through
// the addEkubMember Cloud Function -- a function that requires the caller
// to already BE the Ekub Admin, so a prospective member's own join attempt
// could never succeed.
export const requestToJoinEkub = async (ekubId: string, memberData: { userId: string; displayName: string; userEmail?: string; phoneNumber?: string; photoURL?: string }): Promise<EkubMember> => {
  const memberRef = doc(db, 'ekubs', ekubId, 'members', memberData.userId);
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    const existingData = existing.data() as EkubMember;
    if (existingData.status === 'pending') {
      throw new Error('You already have a pending request to join this Ekub.');
    }
    throw new Error('You are already a member of this Ekub.');
  }

  const requestDoc: EkubMember = {
    userId: memberData.userId,
    displayName: memberData.displayName,
    email: memberData.userEmail,
    phoneNumber: memberData.phoneNumber,
    photoURL: memberData.photoURL,
    role: 'member',
    status: 'pending',
    joinedAt: new Date().toISOString(),
    contributionStatus: 'pending',
    eligibleForDraw: false,
    hasReceivedPayout: false,
    totalContributed: 0,
  };

  await setDoc(memberRef, requestDoc);
  return requestDoc;
};

/**
 * Ekub Admin accepts a pending membership request.
 *
 * NOTE: This action is executed EXCLUSIVELY via the `approveMembershipRequest` Cloud Function.
 * The Cloud Function enforces that only the specific Ekub's assigned Admin can perform this
 * action (not the Super Admin), and a direct Firestore fallback would bypass that restriction
 * whenever the Cloud Function call fails for any reason, including deliberately.
 */
export const approveMembershipRequest = async (ekubId: string, userId: string): Promise<boolean> => {
  try {
    const res = await approveMembershipRequestCallable({ ekubId, userId });
    if (res.data?.success) {
      return true;
    }
    throw new Error('Failed to approve membership request.');
  } catch (err: any) {
    console.error('approveMembershipRequest failed:', err);
    throw new Error(err?.message || 'Failed to approve membership request.');
  }
};

/**
 * Ekub Admin rejects a pending request, or removes an existing active member.
 *
 * NOTE: This action is executed EXCLUSIVELY via the `removeEkubMember` Cloud Function.
 * The Cloud Function enforces that only the specific Ekub's assigned Admin can perform this
 * action (not the Super Admin), and a direct Firestore fallback would bypass that restriction
 * whenever the Cloud Function call fails for any reason, including deliberately.
 */
export const removeEkubMember = async (ekubId: string, userId: string): Promise<boolean> => {
  try {
    const res = await removeEkubMemberCallable({ ekubId, userId });
    if (res.data?.success) {
      return true;
    }
    throw new Error('Failed to remove member.');
  } catch (err: any) {
    console.error('removeEkubMember failed:', err);
    throw new Error(err?.message || 'Failed to remove member.');
  }
};

// Invite a brand-new person to the platform. Public self-registration has
// been removed -- this is now the only way a 'member' account gets
// created. Returns a password-reset link the inviting admin can share
// directly (no automatic email is sent).
// Lists platform users a Super Admin can assign as an Ekub's Admin --
// members only (never another super_admin), so the Reassign/Create-Ekub
// forms can offer a real "pick a person" dropdown instead of requiring a
// raw Firebase UID to be copy-pasted in. Relies on the existing `users`
// collection read rule (any authenticated user can read the collection),
// same as every other client-side Firestore read in this file.
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map(d => d.data() as UserProfile)
      .filter(u => u.role !== 'super_admin' && (u.role as string) !== 'admin');
  } catch (err) {
    console.error('getAllUsers failed:', err);
    return [];
  }
};

export const inviteMember = async (email: string, fullName: string, phoneNumber?: string): Promise<{ uid: string; resetLink: string; alreadyExisted?: boolean }> => {
  try {
    const res = await inviteMemberCallable({ email, fullName, phoneNumber });
    return {
      uid: res.data.uid,
      resetLink: res.data.resetLink,
      alreadyExisted: res.data.alreadyExisted,
    };
  } catch (err: any) {
    console.error('inviteMember failed:', err);
    throw new Error(err?.message || 'Failed to invite member.');
  }
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
  // Try Cloud Function first
  try {
    const result = await addEkubMemberCallable({
      ekubId,
      userId: memberData.userId,
      displayName: memberData.displayName,
      phoneNumber: memberData.phoneNumber,
      photoURL: memberData.photoURL,
    });
    if (result.data?.member) {
      return result.data.member;
    }
  } catch (err: any) {
    if (err?.message?.includes('already a member') || err?.code === 'already-exists') {
      const memberRef = doc(db, 'ekubs', ekubId, 'members', memberData.userId);
      const existingSnap = await getDoc(memberRef);
      if (existingSnap.exists()) {
        return existingSnap.data() as EkubMember;
      }
    }
    console.warn('joinEkub Cloud Function failed, attempting direct Firestore write:', err);
  }

  // Direct Firestore write for Admin / Super Admin
  try {
    const memberRef = doc(db, 'ekubs', ekubId, 'members', memberData.userId);
    const existingSnap = await getDoc(memberRef);
    if (existingSnap.exists()) {
      return existingSnap.data() as EkubMember;
    }

    const memberDoc: EkubMember = {
      userId: memberData.userId,
      displayName: memberData.displayName,
      phoneNumber: memberData.phoneNumber,
      photoURL: memberData.photoURL,
      role: memberData.role || 'member',
      status: memberData.status || 'active',
      joinedAt: new Date().toISOString(),
      contributionStatus: 'pending',
      eligibleForDraw: (memberData.status || 'active') === 'active',
      hasReceivedPayout: false,
      totalContributed: 0,
    };

    const batch = writeBatch(db);
    batch.set(memberRef, memberDoc);
    if ((memberData.status || 'active') === 'active') {
      const ekubRef = doc(db, 'ekubs', ekubId);
      batch.update(ekubRef, {
        currentMemberCount: increment(1),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return memberDoc;
  } catch (directErr: any) {
    console.error('joinEkub direct write failed:', directErr);
    throw new Error(directErr?.message || 'Failed to add member. Only the Ekub Admin or Super Admin can add members.');
  }
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

/**
 * Admin verify payment.
 *
 * NOTE: This action is executed EXCLUSIVELY via the `verifyContribution` Cloud Function.
 * The Cloud Function enforces that only the specific Ekub's assigned Admin can perform this
 * action (not the Super Admin), and a direct Firestore fallback would bypass that restriction
 * whenever the Cloud Function call fails for any reason, including deliberately.
 */
export const verifyPayment = async (ekubId: string, contributionId: string, adminId?: string, adminName?: string, notes?: string): Promise<boolean> => {
  try {
    const res = await verifyContributionCallable({ ekubId, contributionId, notes });
    if (res.data?.success) {
      return true;
    }
    throw new Error('Failed to verify payment.');
  } catch (err: any) {
    console.error('verifyPayment failed:', err);
    throw new Error(err?.message || 'Failed to verify payment. Only the assigned Ekub Admin can verify contributions.');
  }
};

/**
 * Admin reject payment.
 *
 * NOTE: This action is executed EXCLUSIVELY via the `rejectContribution` Cloud Function.
 * The Cloud Function enforces that only the specific Ekub's assigned Admin can perform this
 * action (not the Super Admin), and a direct Firestore fallback would bypass that restriction
 * whenever the Cloud Function call fails for any reason, including deliberately.
 */
export const rejectPayment = async (ekubId: string, contributionId: string, adminId?: string, adminName?: string, reason: string = 'Invalid transaction reference'): Promise<boolean> => {
  try {
    const res = await rejectContributionCallable({ ekubId, contributionId, reason });
    if (res.data?.success) {
      return true;
    }
    throw new Error('Failed to reject payment.');
  } catch (err: any) {
    console.error('rejectPayment failed:', err);
    throw new Error(err?.message || 'Failed to reject payment. Only the assigned Ekub Admin can reject contributions.');
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

// Execute Draw -- Cloud Function only, no exceptions.
//
// There must be no client-side fallback for this operation. Picking a draw
// winner is the single most sensitive financial action in the app; a
// client-side Math.random()/getRandomValues() "fallback" would let the
// browser -- and therefore whoever controls it -- influence or predict the
// outcome, and would let the client supply its own eligibleMembers list
// instead of the server's authoritative one. The Cloud Function always
// reloads eligible members from Firestore itself for this reason.
export const executeDraw = async (params: {
  ekubId: string;
  ekubName: string;
  cycleId: string;
  cycleNumber: number;
}): Promise<{ winner: EkubMember; draw: Draw; proof: any }> => {
  try {
    const res = await executeDrawCallable({
      ekubId: params.ekubId,
      cycleNumber: params.cycleNumber,
    });
    if (!res.data?.draw) {
      throw new Error('Draw execution did not return a valid draw record.');
    }
    return {
      winner: res.data.winner,
      draw: res.data.draw,
      proof: res.data.proof,
    };
  } catch (err: any) {
    console.error('executeDraw failed:', err);
    throw new Error(err?.message || 'Failed to execute draw. Only the Ekub Admin or Super Admin can run a draw.');
  }
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

// Approve Payout -- Cloud Function only. Firestore rules explicitly deny
// direct client writes to a payout's `status` field (see the payouts
// subcollection rule), so there is no working fallback to fall back to.
export const approvePayout = async (ekubId: string, payoutId: string): Promise<boolean> => {
  try {
    const res = await approvePayoutCallable({ ekubId, payoutId });
    return res.data.success;
  } catch (err: any) {
    console.error('approvePayout failed:', err);
    throw new Error(err?.message || 'Failed to approve payout. Only the Ekub Admin or Super Admin can approve payouts.');
  }
};

// Disburse Payout -- Cloud Function only, same reasoning as above.
export const disbursePayout = async (ekubId: string, payoutId: string, paymentReference: string): Promise<boolean> => {
  try {
    const res = await disbursePayoutCallable({ ekubId, payoutId, paymentReference });
    return res.data.success;
  } catch (err: any) {
    console.error('disbursePayout failed:', err);
    throw new Error(err?.message || 'Failed to disburse payout. Only the Ekub Admin or Super Admin can disburse payouts.');
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
  if (!userId) return;
  try {
    // Only the user's OWN notification docs (userId == their uid) can be
    // updated by them per the security rules -- broadcast docs (userId ==
    // 'all') are shared across every user, so flipping `read` on one would
    // both fail the rule (they don't own it) and incorrectly hide it for
    // everyone else. A writeBatch is all-or-nothing, so 'all' docs must be
    // excluded before batching or the whole batch would be rejected.
    const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Failed to mark notifications as read:', err);
  }
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
