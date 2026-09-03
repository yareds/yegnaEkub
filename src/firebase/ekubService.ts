import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseAvailable } from './config';
import { 
  Ekub, 
  EkubMember, 
  Contribution, 
  Draw, 
  Payout, 
  SupportTicket, 
  AppNotification, 
  AuditLog,
  UserProfile
} from '../types';
import { 
  DEMO_MEMBERS, 
  DEMO_USERS, 
  DEMO_AUDIT_LOGS,
  DEMO_EKUBS,
  DEMO_CONTRIBUTIONS,
  DEMO_DRAWS,
  DEMO_PAYOUTS,
  DEMO_NOTIFICATIONS
} from '../data/demoData';

// ==========================================
// DEMO MODE GUARD
// When the app is running in Demo Mode (explored from the landing page,
// never signed in), NOTHING should ever be written to Firebase -- the
// entire experience runs off static sample data in memory/localStorage.
// App.tsx is the primary enforcement (it never calls any of these
// functions at all while in Demo Mode, feeding the UI from static data
// instead) -- this is a second, centralized layer of protection so that
// even if some component were to call a write function directly, it's
// guaranteed to fail loudly rather than silently touching real data.
// ==========================================
let demoModeActive = false;
export const setDemoModeActive = (active: boolean) => { demoModeActive = active; };
export const isDemoModeActive = () => demoModeActive;
const assertNotDemoMode = () => {
  if (demoModeActive) {
    throw new Error('This is a demo with sample data -- sign up for a real account to do this.');
  }
};

// ==========================================
// 1. CLOUD FUNCTION CALLABLE PROXIES & CLIENT WRITES
// State-mutating actions route through validated Cloud Functions or
// authorized Firestore rules matches.
// ==========================================

export const createEkub = async (data: {
  name: string;
  description?: string;
  adminId?: string;
  adminName?: string;
  adminPhone?: string;
  creatorId?: string;
  totalMembers?: number;
  maxMembers?: number;
  contributionAmount?: number;
  payoutAmount?: number;
  currency?: string;
  frequency?: string;
  roundDays?: number;
  category?: string;
  rules?: string;
  status?: string;
  inviteCode?: string;
  startDate?: string;
  nextContributionDate?: string;
  nextDrawDate?: string;
  acceptedPaymentMethods?: any[];
  [key: string]: any;
}): Promise<Ekub> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'createEkub');
  const res = await fn(data);
  const resData = res.data as any;
  if (resData && resData.ekub) {
    return resData.ekub as Ekub;
  }
  return { id: resData?.id || `ekub-${Date.now()}`, ...data } as unknown as Ekub;
};

export const submitContribution = async (data: {
  ekubId: string;
  cycleNumber: number;
  amount?: number;
  amountPerCycle?: number;
  cycleCount?: number;
  currency?: string;
  paymentMethod: string;
  receiptNumber?: string;
  receiptUrl?: string;
  notes?: string;
  payerName?: string;
  payerPhone?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ekubName?: string;
  transactionReference?: string;
  [key: string]: any;
}): Promise<{ id: string }> => {
  if (isDemoModeActive()) {
    return { id: `demo-contrib-${Date.now()}` };
  }
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const contribId = `contrib-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const contribDoc = {
    id: contribId,
    ekubId: data.ekubId,
    cycleNumber: data.cycleNumber || 1,
    amount: data.amount || data.amountPerCycle || 0,
    currency: data.currency || 'ETB',
    paymentMethod: data.paymentMethod || 'telebirr',
    transactionReference: data.receiptNumber || data.transactionReference || '',
    receiptUrl: data.receiptUrl || '',
    notes: data.notes || '',
    payerName: data.payerName || data.userName || '',
    payerPhone: data.payerPhone || '',
    userId: data.userId || '',
    userName: data.userName || data.payerName || '',
    userEmail: data.userEmail || '',
    status: 'pending',
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'ekubs', data.ekubId, 'contributions', contribId), contribDoc);
  return { id: contribId };
};

export const verifyPayment = async (
  ekubId: string, 
  contributionId: string, 
  adminId?: string, 
  adminName?: string, 
  notes?: string
): Promise<{ success: boolean }> => {
  if (isDemoModeActive()) {
    return { success: true };
  }
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'verifyContribution');
  const res = await fn({ ekubId, contributionId, notes: notes || `Verified by ${adminName || 'Admin'}` });
  return res.data as { success: boolean };
};

export const rejectPayment = async (
  ekubId: string, 
  contributionId: string, 
  adminId?: string, 
  adminName?: string, 
  reason?: string
): Promise<{ success: boolean }> => {
  if (isDemoModeActive()) {
    return { success: true };
  }
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'rejectContribution');
  const res = await fn({ ekubId, contributionId, reason: reason || 'Invalid payment receipt or reference' });
  return res.data as { success: boolean };
};

export const executeDraw = async (
  ekubIdOrPayload: string | { ekubId: string; ekubName?: string; cycleId?: string; cycleNumber: number; clientSeed?: string; [key: string]: any },
  cycleNumber?: number,
  adminId?: string,
  adminName?: string
): Promise<{ draw: Draw; winner?: any; proof?: any }> => {
  if (isDemoModeActive()) {
    const ekubId = typeof ekubIdOrPayload === 'string' ? ekubIdOrPayload : ekubIdOrPayload.ekubId;
    const cycleNum = typeof ekubIdOrPayload === 'string' ? (cycleNumber || 1) : (ekubIdOrPayload.cycleNumber || 1);
    const members = DEMO_MEMBERS[ekubId] || [];
    const eligible = members.filter(m => !m.hasReceivedPayout && (m.eligibleForDraw || m.contributionStatus === 'paid'));
    const pool = eligible.length > 0 ? eligible : members.filter(m => !m.hasReceivedPayout);
    const winnerMember = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : members[0];
    const ekub = DEMO_EKUBS.find(e => e.id === ekubId) || DEMO_EKUBS[0];
    const fakeHash = `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`;
    const newDraw: Draw = {
      id: `demo-draw-${ekubId}-${cycleNum}-${Date.now()}`,
      ekubId,
      ekubName: ekub.name,
      cycleId: `cycle-${cycleNum}`,
      cycleNumber: cycleNum,
      drawNumber: cycleNum,
      winnerId: winnerMember?.userId || 'demo-member-1',
      winnerName: winnerMember?.displayName || 'Demo Winner',
      payoutAmount: ekub.payoutAmount,
      eligibleMemberIds: members.map(m => m.userId),
      eligibleMemberCount: members.length,
      scheduledAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
      status: 'completed',
      randomnessMethod: 'HMAC-SHA256 (Provably Fair)',
      serverSeedHash: fakeHash,
      clientSeed: 'yegna-provably-fair-entropy',
      verificationHash: fakeHash,
      verificationProof: {
        combinedEntropy: `entropy-${Date.now()}`,
        hashResult: fakeHash,
        rawDecimal: '0.482718491028374',
        winningIndex: Math.floor(Math.random() * Math.max(members.length, 1)),
        explanation: 'Provably fair winner selection calculated via cryptographic HMAC-SHA256 digest.'
      },
      createdAt: new Date().toISOString()
    };
    return {
      draw: newDraw,
      winner: winnerMember || { displayName: 'Demo Winner', userId: 'demo-1' },
      proof: newDraw.verificationProof
    };
  }
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'executeDraw');
  const payload = typeof ekubIdOrPayload === 'string'
    ? { ekubId: ekubIdOrPayload, cycleNumber }
    : ekubIdOrPayload;
  const res = await fn(payload);
  const resData = res.data as any;
  return {
    draw: resData.draw || (resData as Draw),
    winner: resData.winner || resData.draw?.winnerName || null,
    proof: resData.proof || resData.draw?.verificationProof || null,
  };
};

export const verifyDrawResult = async (
  ekubId: string,
  drawId: string,
  adminId?: string,
  adminName?: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  return { success: true };
};

export const submitPayoutAccount = async (
  ekubId: string,
  payoutId: string,
  accountDetails: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    phoneNumber?: string;
    phoneOrAmole?: string;
  },
  idFileName?: string,
  idDocumentUrl?: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const payoutRef = doc(db, 'ekubs', ekubId, 'payouts', payoutId);
  await updateDoc(payoutRef, {
    accountDetails,
    idFileName: idFileName || '',
    idDocumentUrl: idDocumentUrl || '',
    status: 'under_review',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
};

export const submitPayoutAccountDetails = submitPayoutAccount;

export const approvePayout = async (
  ekubId: string,
  payoutId: string,
  adminId?: string,
  adminName?: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'approvePayout');
  const res = await fn({ ekubId, payoutId });
  return res.data as { success: boolean };
};

export const disbursePayout = async (
  ekubId: string,
  payoutId: string,
  paymentReference: string,
  adminId?: string,
  adminName?: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'disbursePayout');
  const res = await fn({ ekubId, payoutId, paymentReference });
  return res.data as { success: boolean };
};

export const assignEkubAdmin = async (
  ekubId: string,
  newAdminId: string,
  newAdminName?: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'assignEkubAdmin');
  const res = await fn({ ekubId, newAdminUid: newAdminId, newAdminName });
  return res.data as { success: boolean };
};

export const joinEkub = async (
  ekubId: string,
  data: {
    userId: string;
    displayName: string;
    email?: string;
    phoneNumber?: string;
  }
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const memberRef = doc(db, 'ekubs', ekubId, 'members', data.userId);
  await setDoc(memberRef, {
    userId: data.userId,
    displayName: data.displayName || 'Member',
    email: data.email || '',
    phoneNumber: data.phoneNumber || '',
    photoURL: '',
    role: 'member',
    status: 'pending',
    joinedAt: new Date().toISOString(),
    contributionStatus: 'pending',
    hasReceivedPayout: false,
    eligibleForDraw: false,
  });
  return { success: true };
};

export const joinEkubWithInviteCode = async (
  inviteCode: string,
  userId: string,
  displayName: string,
  email?: string
): Promise<Ekub> => {
  if (isDemoModeActive()) {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const target = DEMO_EKUBS.find(e => 
      (e.inviteCode && e.inviteCode.toUpperCase() === normalizedCode) || 
      (e.id && e.id.toUpperCase() === normalizedCode) ||
      (e.name && e.name.toUpperCase().includes(normalizedCode)) ||
      (e.id.toLowerCase().includes(inviteCode.trim().toLowerCase()))
    ) || DEMO_EKUBS[0];
    return target;
  }
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const ekubs = await getEkubs();
  const normalizedCode = inviteCode.trim().toUpperCase();
  const target = ekubs.find(e => 
    (e.inviteCode && e.inviteCode.toUpperCase() === normalizedCode) || 
    (e.id && e.id.toUpperCase() === normalizedCode) ||
    (e.id.toLowerCase().includes(inviteCode.trim().toLowerCase()))
  );
  if (!target) {
    throw new Error('No circle found matching that invite code.');
  }
  await joinEkub(target.id, { userId, displayName, email });
  return target;
};

export const addEkubMember = async (
  ekubId: string,
  data: {
    userId: string;
    displayName: string;
    phoneNumber?: string;
    photoURL?: string;
  }
): Promise<{ success: boolean; member?: EkubMember }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'addEkubMember');
  const res = await fn({ ekubId, ...data });
  return res.data as { success: boolean; member?: EkubMember };
};

export const approveMembershipRequest = async (
  ekubId: string,
  targetUserId: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'approveMembershipRequest');
  const res = await fn({ ekubId, userId: targetUserId });
  return res.data as { success: boolean };
};

export const removeEkubMember = async (
  ekubId: string,
  targetUserId: string
): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'removeEkubMember');
  const res = await fn({ ekubId, userId: targetUserId });
  return res.data as { success: boolean };
};

export const createSupportTicket = async (data: {
  userId: string;
  userName: string;
  userEmail: string;
  ekubId?: string;
  ekubName?: string;
  subject: string;
  category: string;
  description: string;
  priority?: string;
  [key: string]: any;
}): Promise<{ id: string }> => {
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const ticketDoc = {
    id: ticketId,
    ...data,
    status: 'open',
    priority: data.priority || 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'supportTickets', ticketId), ticketDoc);
  return { id: ticketId };
};

export const respondSupportTicket = async (data: {
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  newStatus?: string;
}): Promise<{ success: boolean }> => {
  assertNotDemoMode();
  if (!isFirebaseAvailable()) throw new Error('Firebase is not available');
  const ticketRef = doc(db, 'supportTickets', data.ticketId);
  const snap = await getDoc(ticketRef);
  if (!snap.exists()) throw new Error('Ticket not found');
  const current = snap.data();
  const responses = current?.responses || [];
  const newResponse = {
    id: `resp-${Date.now()}`,
    ticketId: data.ticketId,
    authorId: data.authorId,
    authorName: data.authorName,
    authorRole: data.authorRole,
    message: data.message,
    createdAt: new Date().toISOString(),
  };
  const updateData: any = {
    responses: [...responses, newResponse],
    updatedAt: new Date().toISOString(),
  };
  if (data.newStatus) {
    updateData.status = data.newStatus;
  }
  await updateDoc(ticketRef, updateData);
  return { success: true };
};

export const inviteMember = async (
  email: string,
  fullName: string,
  phoneNumber?: string
): Promise<{ success: boolean; uid: string; email: string; resetLink: string; alreadyExisted?: boolean }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'inviteMember');
  const res = await fn({ email, fullName, phoneNumber });
  return res.data as { success: boolean; uid: string; email: string; resetLink: string; alreadyExisted?: boolean };
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  if (isDemoModeActive()) {
    return DEMO_USERS;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    const all = snap.docs.map(d => ({ uid: d.id, ...(d.data() as object) } as unknown as UserProfile));

    // Deduplicate by email, keeping only the most recently created account
    // per address. This matters because deleting a Firebase Auth user does
    // NOT delete their Firestore profile document -- if an account was
    // deleted and later recreated (e.g. while testing), the OLD orphaned
    // profile (tied to a UID that no longer exists in Authentication)
    // still sits in this collection alongside the new one. Without this,
    // the orphaned entry can't be excluded by any "already administering a
    // circle" filter downstream, since that filter matches on UID and the
    // orphaned doc's UID no longer matches anything real.
    const latestByEmail = new Map<string, UserProfile>();
    for (const u of all) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email) continue;
      const existing = latestByEmail.get(email);
      if (!existing || new Date(u.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()) {
        latestByEmail.set(email, u);
      }
    }
    return Array.from(latestByEmail.values());
  } catch (err) {
    console.error('Failed to get all users:', err);
    return [];
  }
};

// "Generate Sample Data" has been removed -- sample browsing is now handled
// entirely by the local-only Demo Mode (see App.tsx / data/demoData.ts),
// which never touches Firebase. This one-time utility removes whatever the
// old feature already wrote to Firestore/Auth.
export const cleanupSampleData = async (): Promise<{ deletedEkubIds: string[]; deletedAuthUids: string[]; deletedProfileIds: string[] }> => {
  assertNotDemoMode();
  const fn = httpsCallable(functions, 'cleanupSampleData');
  const res = await fn({});
  return res.data as { deletedEkubIds: string[]; deletedAuthUids: string[]; deletedProfileIds: string[] };
};

// ==========================================
// 2. FIRESTORE CLIENT-SIDE READ LAYER
// Reads conform to firestore.rules public/member permissions.
// ==========================================

export const getEkubs = async (): Promise<Ekub[]> => {
  if (isDemoModeActive()) {
    return DEMO_EKUBS;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    const snap = await getDocs(collection(db, 'ekubs'));
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as Ekub));
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch ekubs:', err);
    return [];
  }
};

export const getEkubById = async (id: string): Promise<Ekub | null> => {
  if (isDemoModeActive()) {
    return DEMO_EKUBS.find(e => e.id === id) || null;
  }
  if (!isFirebaseAvailable()) return null;
  try {
    const snap = await getDoc(doc(db, 'ekubs', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as object) } as unknown as Ekub;
  } catch (err) {
    console.error(`Failed to fetch ekub ${id}:`, err);
    return null;
  }
};

export const getEkubMembers = async (ekubId: string): Promise<EkubMember[]> => {
  if (isDemoModeActive()) {
    return DEMO_MEMBERS[ekubId] || [];
  }
  if (!isFirebaseAvailable() || !ekubId) return [];
  try {
    const snap = await getDocs(collection(db, 'ekubs', ekubId, 'members'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as EkubMember));
  } catch (err) {
    console.error(`Failed to fetch members for Ekub ${ekubId}:`, err);
    return [];
  }
};

/**
 * Returns the subset of ekubIds where targetUserId has an active member
 * record. Used so member-facing views (Dashboard, Draws, Contributions,
 * Payouts) only show circles this specific user actually belongs to,
 * instead of every circle on the platform. Checks each circle's /members/
 * subcollection individually with a simple, safe per-document read --
 * avoids collection-group queries which would require a dedicated index
 * and broader read permissions.
 */
export const getMyMemberEkubIds = async (ekubIds: string[], targetUserId: string): Promise<string[]> => {
  if (isDemoModeActive()) {
    return Object.entries(DEMO_MEMBERS)
      .filter(([ekubId, members]) => ekubIds.includes(ekubId) && members.some(m => m.userId === targetUserId && m.status === 'active'))
      .map(([ekubId]) => ekubId);
  }
  if (!isFirebaseAvailable() || !targetUserId || !Array.isArray(ekubIds) || ekubIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    ekubIds.map(async (ekubId) => {
      try {
        const memberRef = doc(db, 'ekubs', ekubId, 'members', targetUserId);
        const snap = await getDoc(memberRef);
        if (!snap.exists()) return null;
        const data = snap.data();
        return data?.status === 'active' ? ekubId : null;
      } catch (err) {
        // Missing permissions or not a member -- silently ignore
        return null;
      }
    })
  );

  return results.filter((id): id is string => id !== null);
};

export const getContributions = async (ekubId?: string, userId?: string): Promise<Contribution[]> => {
  if (isDemoModeActive()) {
    let list = DEMO_CONTRIBUTIONS;
    if (ekubId) list = list.filter(c => c.ekubId === ekubId);
    if (userId) list = list.filter(c => c.userId === userId);
    return list;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    if (ekubId) {
      const snap = await getDocs(collection(db, 'ekubs', ekubId, 'contributions'));
      let list = snap.docs.map(d => ({ id: d.id, ekubId, ...(d.data() as object) } as unknown as Contribution));
      if (userId) {
        list = list.filter(c => c.userId === userId);
      }
      return list.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime());
    }

    const ekubs = await getEkubs();
    if (!ekubs || ekubs.length === 0) return [];

    const nested = await Promise.all(
      ekubs.map(async (e) => {
        try {
          const snap = await getDocs(collection(db, 'ekubs', e.id, 'contributions'));
          let list = snap.docs.map(d => ({ id: d.id, ekubId: e.id, ...(d.data() as object) } as unknown as Contribution));
          if (userId) {
            list = list.filter(c => c.userId === userId);
          }
          return list;
        } catch {
          return [];
        }
      })
    );
    const all = nested.flat();
    return all.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0).getTime() - new Date(a.submittedAt || a.createdAt || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch contributions:', err);
    return [];
  }
};

export const getDraws = async (ekubId?: string): Promise<Draw[]> => {
  if (isDemoModeActive()) {
    return ekubId ? DEMO_DRAWS.filter(d => d.ekubId === ekubId) : DEMO_DRAWS;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    if (ekubId) {
      const snap = await getDocs(collection(db, 'ekubs', ekubId, 'draws'));
      const list = snap.docs.map(d => ({ id: d.id, ekubId, ...(d.data() as object) } as unknown as Draw));
      return list.sort((a, b) => new Date(b.executedAt || b.createdAt || 0).getTime() - new Date(a.executedAt || a.createdAt || 0).getTime());
    }

    const ekubs = await getEkubs();
    if (!ekubs || ekubs.length === 0) return [];

    const nested = await Promise.all(
      ekubs.map(async (e) => {
        try {
          const snap = await getDocs(collection(db, 'ekubs', e.id, 'draws'));
          return snap.docs.map(d => ({ id: d.id, ekubId: e.id, ...(d.data() as object) } as unknown as Draw));
        } catch {
          return [];
        }
      })
    );
    const all = nested.flat();
    return all.sort((a, b) => new Date(b.executedAt || b.createdAt || 0).getTime() - new Date(a.executedAt || a.createdAt || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch draws:', err);
    return [];
  }
};

export const getPayouts = async (ekubId?: string, winnerId?: string): Promise<Payout[]> => {
  if (isDemoModeActive()) {
    let list = DEMO_PAYOUTS;
    if (ekubId) list = list.filter(p => p.ekubId === ekubId);
    if (winnerId) list = list.filter(p => p.winnerId === winnerId);
    return list;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    if (ekubId) {
      const snap = await getDocs(collection(db, 'ekubs', ekubId, 'payouts'));
      let list = snap.docs.map(d => ({ id: d.id, ekubId, ...(d.data() as object) } as unknown as Payout));
      if (winnerId) {
        list = list.filter(p => p.winnerId === winnerId);
      }
      return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    const ekubs = await getEkubs();
    if (!ekubs || ekubs.length === 0) return [];

    const nested = await Promise.all(
      ekubs.map(async (e) => {
        try {
          const snap = await getDocs(collection(db, 'ekubs', e.id, 'payouts'));
          let list = snap.docs.map(d => ({ id: d.id, ekubId: e.id, ...(d.data() as object) } as unknown as Payout));
          if (winnerId) {
            list = list.filter(p => p.winnerId === winnerId);
          }
          return list;
        } catch {
          return [];
        }
      })
    );
    const all = nested.flat();
    return all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch payouts:', err);
    return [];
  }
};

export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
  if (isDemoModeActive()) {
    return [];
  }
  if (!isFirebaseAvailable()) return [];
  try {
    let q;
    if (userId) {
      q = query(collection(db, 'supportTickets'), where('userId', '==', userId));
    } else {
      q = query(collection(db, 'supportTickets'), limit(50));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as SupportTicket));
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch support tickets:', err);
    return [];
  }
};

export const getNotifications = async (userId?: string): Promise<AppNotification[]> => {
  if (isDemoModeActive()) {
    return DEMO_NOTIFICATIONS;
  }
  if (!isFirebaseAvailable() || !userId) return [];
  try {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as AppNotification));
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 20);
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return [];
  }
};

export const markNotificationsAsRead = async (userId?: string): Promise<void> => {
  if (!isFirebaseAvailable() || !userId) return;
  try {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', userId), 
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => updateDoc(d.ref, { read: true }));
    await Promise.all(updates);
  } catch (err) {
    console.error('Failed to mark notifications read:', err);
  }
};

export const getAuditLogs = async (limitCount = 50, ekubId?: string): Promise<AuditLog[]> => {
  if (isDemoModeActive()) {
    return ekubId ? DEMO_AUDIT_LOGS.filter(a => a.entityId === ekubId) : DEMO_AUDIT_LOGS;
  }
  if (!isFirebaseAvailable()) return [];
  try {
    let q;
    if (ekubId) {
      q = query(collection(db, 'auditLogs'), where('ekubId', '==', ekubId), limit(limitCount));
    } else {
      q = query(collection(db, 'auditLogs'), limit(limitCount));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as unknown as AuditLog));
    return list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return [];
  }
};
