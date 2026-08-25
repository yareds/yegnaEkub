import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// --- Internal Helper: Check if caller is Super Admin ---
async function checkIsSuperAdmin(uid: string, authData?: any): Promise<boolean> {
  if (authData?.token?.yegnaEkub_super_admin === true) {
    return true;
  }
  if (authData?.token?.email === 'yared.abegaz@gmail.com') {
    return true;
  }
  const adminDoc = await db.collection('admins').doc(uid).get();
  return adminDoc.exists;
}

// --- Internal Helper: Check if caller is Ekub Admin or Super Admin ---
async function checkIsEkubAdminOrSuperAdmin(uid: string, ekubId: string, authData?: any): Promise<{ isSuper: boolean; isEkubAdm: boolean; ekubDoc: FirebaseFirestore.DocumentSnapshot }> {
  const isSuper = await checkIsSuperAdmin(uid, authData);
  const ekubRef = db.collection('ekubs').doc(ekubId);
  const ekubDoc = await ekubRef.get();

  if (!ekubDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Ekub ${ekubId} does not exist.`);
  }

  const ekubData = ekubDoc.data();
  const isEkubAdm = ekubData?.adminId === uid;

  if (!isSuper && !isEkubAdm) {
    throw new functions.https.HttpsError('permission-denied', 'Only the assigned Ekub Admin or Super Admin can perform this operation.');
  }

  return { isSuper, isEkubAdm, ekubDoc };
}

// --- Internal Helper: Server-Authoritative Audit Logger (bypasses security rules via Admin SDK) ---
async function writeAuditLog(logData: {
  actorId: string;
  actorName: string;
  actorRole: 'super_admin' | 'admin' | 'member';
  action: string;
  entityType: 'ekub' | 'payment' | 'draw' | 'payout' | 'member' | 'admin';
  entityId: string;
  ekubId?: string;
  reason: string;
  newState?: any;
  previousState?: any;
}) {
  try {
    const logId = `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const logRecord = {
      id: logId,
      ...logData,
      timestamp: new Date().toISOString(),
    };
    await db.collection('auditLogs').doc(logId).set(logRecord);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ============================================================================
// 1. CREATE EKUB (Super Admin Only)
// ============================================================================
export const createEkub = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const isSuper = await checkIsSuperAdmin(context.auth.uid, context.auth);
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only Super Admin can create Ekubs.');
  }

  const ekubId = data.id || `ekub-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const adminUid = data.adminId || context.auth.uid;
  const adminName = data.adminName || 'Assigned Admin';

  const newEkub = {
    id: ekubId,
    name: data.name,
    description: data.description || '',
    category: data.category || 'General',
    frequency: data.frequency || 'monthly',
    contributionAmount: Number(data.contributionAmount) || 1000,
    memberLimit: Number(data.memberLimit) || 10,
    payoutAmount: Number(data.payoutAmount) || (Number(data.contributionAmount) * Number(data.memberLimit)),
    currentMemberCount: 1,
    currentCycle: 1,
    totalCycles: Number(data.memberLimit) || 10,
    startDate: data.startDate || new Date().toISOString().split('T')[0],
    nextContributionDate: data.nextContributionDate || new Date().toISOString().split('T')[0],
    nextDrawDate: data.nextDrawDate || new Date().toISOString(),
    status: 'recruiting',
    currency: 'ETB',
    isPrivate: data.isPrivate ?? false,
    adminId: adminUid,
    adminName: adminName,
    adminHistory: [
      {
        previousAdminId: '',
        newAdminId: adminUid,
        newAdminName: adminName,
        assignedAt: new Date().toISOString(),
        assignedBy: context.auth.uid,
      }
    ],
    createdAt: new Date().toISOString(),
  };

  const initialAdminMember = {
    userId: adminUid,
    displayName: adminName,
    role: 'admin',
    status: 'active',
    joinedAt: new Date().toISOString(),
    contributionStatus: 'pending',
    hasReceivedPayout: false,
    eligibleForDraw: true,
  };

  // Execute creation in an atomic transaction
  await db.runTransaction(async (transaction) => {
    const ekubRef = db.collection('ekubs').doc(ekubId);
    const memberRef = ekubRef.collection('members').doc(adminUid);
    transaction.set(ekubRef, newEkub);
    transaction.set(memberRef, initialAdminMember);
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: adminName,
    actorRole: 'super_admin',
    action: 'EKUB_CREATED',
    entityType: 'ekub',
    entityId: ekubId,
    ekubId,
    reason: `Super Admin created Ekub circle "${newEkub.name}" with initial Admin "${adminName}"`,
    newState: { adminId: adminUid, name: newEkub.name, contributionAmount: newEkub.contributionAmount },
  });

  return { success: true, ekub: newEkub };
});

// ============================================================================
// 2. ASSIGN EKUB ADMIN (Super Admin Only)
// ============================================================================
export const assignEkubAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const isSuper = await checkIsSuperAdmin(context.auth.uid, context.auth);
  if (!isSuper) {
    throw new functions.https.HttpsError('permission-denied', 'Only Super Admin can reassign Ekub Admins.');
  }

  const { ekubId, newAdminUid, newAdminName } = data;
  if (!ekubId || !newAdminUid) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and newAdminUid are required.');
  }

  const ekubRef = db.collection('ekubs').doc(ekubId);
  const ekubDoc = await ekubRef.get();
  if (!ekubDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Ekub ${ekubId} not found.`);
  }

  const ekubData = ekubDoc.data()!;
  const oldAdminId = ekubData.adminId;

  // Retrieve user record for display name if not passed
  let resolvedAdminName = newAdminName;
  if (!resolvedAdminName) {
    const userDoc = await db.collection('users').doc(newAdminUid).get();
    resolvedAdminName = userDoc.exists ? userDoc.data()?.fullName || userDoc.data()?.displayName : 'New Ekub Admin';
  }

  const historyEntry = {
    previousAdminId: oldAdminId || '',
    newAdminId: newAdminUid,
    newAdminName: resolvedAdminName,
    assignedAt: new Date().toISOString(),
    assignedBy: context.auth.uid,
  };

  await db.runTransaction(async (transaction) => {
    // 1. Update Ekub Doc
    transaction.update(ekubRef, {
      adminId: newAdminUid,
      adminName: resolvedAdminName,
      adminHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
    });

    // 2. Demote old admin's member doc if exists
    if (oldAdminId && oldAdminId !== newAdminUid) {
      const oldMemberRef = ekubRef.collection('members').doc(oldAdminId);
      const oldMemberDoc = await transaction.get(oldMemberRef);
      if (oldMemberDoc.exists) {
        transaction.update(oldMemberRef, { role: 'member' });
      }
    }

    // 3. Promote/create new admin's member doc
    const newMemberRef = ekubRef.collection('members').doc(newAdminUid);
    const newMemberDoc = await transaction.get(newMemberRef);
    if (newMemberDoc.exists) {
      transaction.update(newMemberRef, { role: 'admin', status: 'active' });
    } else {
      transaction.set(newMemberRef, {
        userId: newAdminUid,
        displayName: resolvedAdminName,
        role: 'admin',
        status: 'active',
        joinedAt: new Date().toISOString(),
        contributionStatus: 'pending',
        hasReceivedPayout: false,
        eligibleForDraw: true,
      });
    }
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: 'Super Admin',
    actorRole: 'super_admin',
    action: 'ADMIN_REASSIGNED',
    entityType: 'admin',
    entityId: newAdminUid,
    ekubId,
    reason: `Super Admin reassigned Ekub Admin from ${oldAdminId} to ${newAdminUid} (${resolvedAdminName})`,
    newState: { adminId: newAdminUid, adminName: resolvedAdminName },
    previousState: { adminId: oldAdminId },
  });

  return { success: true, message: `Ekub Admin reassigned to ${resolvedAdminName}.` };
});

// ============================================================================
// 3. ADD EKUB MEMBER (Super Admin or Ekub Admin)
// ============================================================================
export const addEkubMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, userId, displayName, phoneNumber, photoURL } = data;
  if (!ekubId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and userId are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const ekubRef = db.collection('ekubs').doc(ekubId);
  const memberRef = ekubRef.collection('members').doc(userId);

  const memberDoc = await memberRef.get();
  if (memberDoc.exists) {
    throw new functions.https.HttpsError('already-exists', 'User is already a member of this Ekub.');
  }

  const newMember = {
    userId,
    displayName: displayName || 'Member',
    phoneNumber: phoneNumber || '',
    photoURL: photoURL || '',
    role: 'member',
    status: 'active',
    joinedAt: new Date().toISOString(),
    contributionStatus: 'pending',
    hasReceivedPayout: false,
    eligibleForDraw: true,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(memberRef, newMember);
    transaction.update(ekubRef, {
      currentMemberCount: admin.firestore.FieldValue.increment(1),
    });
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'MEMBER_ADDED',
    entityType: 'member',
    entityId: userId,
    ekubId,
    reason: `Admin added new member ${displayName || userId} to Ekub ${ekubId}`,
    newState: newMember,
  });

  return { success: true, member: newMember };
});

// ============================================================================
// 4. VERIFY CONTRIBUTION / REJECT CONTRIBUTION (Super Admin or Ekub Admin)
// ============================================================================
export const verifyContribution = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, contributionId, notes } = data;
  if (!ekubId || !contributionId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and contributionId are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const contribRef = db.collection('ekubs').doc(ekubId).collection('contributions').doc(contributionId);
  const contribDoc = await contribRef.get();
  if (!contribDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Contribution ${contributionId} not found.`);
  }

  const contribData = contribDoc.data()!;
  const memberRef = db.collection('ekubs').doc(ekubId).collection('members').doc(contribData.userId);

  await db.runTransaction(async (transaction) => {
    transaction.update(contribRef, {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: context.auth!.uid,
      adminNotes: notes || 'Verified by Admin',
    });

    const memberDoc = await transaction.get(memberRef);
    if (memberDoc.exists) {
      transaction.update(memberRef, {
        contributionStatus: 'paid',
        eligibleForDraw: true,
        lastContributionDate: new Date().toISOString(),
      });
    }
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'PAYMENT_VERIFIED',
    entityType: 'payment',
    entityId: contributionId,
    ekubId,
    reason: notes || `Payment of ${contribData.amount} ETB for ${contribData.userName || contribData.userId} verified`,
    newState: { status: 'verified', verifiedBy: context.auth.uid },
  });

  return { success: true, message: 'Contribution verified successfully.' };
});

export const rejectContribution = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, contributionId, reason } = data;
  if (!ekubId || !contributionId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId, contributionId, and reason are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const contribRef = db.collection('ekubs').doc(ekubId).collection('contributions').doc(contributionId);
  const contribDoc = await contribRef.get();
  if (!contribDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Contribution ${contributionId} not found.`);
  }

  const contribData = contribDoc.data()!;
  const memberRef = db.collection('ekubs').doc(ekubId).collection('members').doc(contribData.userId);

  await db.runTransaction(async (transaction) => {
    transaction.update(contribRef, {
      status: 'rejected',
      rejectionReason: reason || 'Invalid payment receipt or reference',
      verifiedBy: context.auth!.uid,
    });

    const memberDoc = await transaction.get(memberRef);
    if (memberDoc.exists) {
      transaction.update(memberRef, {
        contributionStatus: 'overdue',
        eligibleForDraw: false,
      });
    }
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'PAYMENT_REJECTED',
    entityType: 'payment',
    entityId: contributionId,
    ekubId,
    reason: reason || 'Rejected due to invalid transaction reference',
    newState: { status: 'rejected', reason },
  });

  return { success: true, message: 'Contribution rejected.' };
});

// ============================================================================
// 5. EXECUTE DRAW (Super Admin or Ekub Admin)
// Server loads eligible members, generates server entropy, writes draw +
// payout, and advances the cycle -- all inside one transaction so that two
// concurrent calls (two admins, or a double-click) cannot both succeed for
// the same cycle. The draw/payout document IDs are deterministic
// (ekubId + cycleNumber, not a timestamp), so the idempotency check below
// is meaningful: a retried/duplicate call targeting the same cycle will
// find the draw doc already exists and be rejected, rather than silently
// creating a second draw and a second payout for the same cycle.
// ============================================================================
export const executeDraw = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, clientSeed: providedClientSeed } = data;
  if (!ekubId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId is required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const result = await db.runTransaction(async (transaction) => {
    const ekubRef = db.collection('ekubs').doc(ekubId);
    const ekubSnap = await transaction.get(ekubRef);
    if (!ekubSnap.exists) {
      throw new functions.https.HttpsError('not-found', `Ekub ${ekubId} not found.`);
    }
    const ekubData = ekubSnap.data()!;
    const cycleNumber = ekubData.currentCycle || 1;

    // Deterministic IDs -- the idempotency guard below relies on this.
    const drawId = `draw-${ekubId}-cycle-${cycleNumber}`;
    const payoutId = `payout-${ekubId}-cycle-${cycleNumber}`;
    const drawRef = ekubRef.collection('draws').doc(drawId);

    // Duplicate-draw guard: refuse if this cycle has already been drawn,
    // instead of silently creating a second draw/payout for it.
    const existingDraw = await transaction.get(drawRef);
    if (existingDraw.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        `Cycle ${cycleNumber} has already been drawn for this Ekub.`
      );
    }

    const membersSnap = await transaction.get(ekubRef.collection('members'));
    if (membersSnap.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'No members found in this Ekub.');
    }

    const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    // Eligible members: have not yet received a payout, and paid for current cycle
    let eligibleMembers = allMembers.filter(m => !m.hasReceivedPayout && (m.eligibleForDraw || m.contributionStatus === 'paid'));
    if (eligibleMembers.length === 0) {
      eligibleMembers = allMembers.filter(m => !m.hasReceivedPayout);
    }

    if (eligibleMembers.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'All members have already won their payout cycles.');
    }

    const payoutAmount = ekubData.payoutAmount || (ekubData.contributionAmount * ekubData.memberLimit);

    // Cryptographically secure randomness generation
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = providedClientSeed || `yegna-ekub-${ekubId}-cycle-${cycleNumber}-${Date.now()}`;
    const nonce = Math.floor(Math.random() * 1000000);

    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}:${cycleNumber}`);
    const hashResult = hmac.digest('hex');

    // Convert first 12 hex characters (48 bits) to integer
    const hexSlice = hashResult.substring(0, 12);
    const rawDecimal = parseInt(hexSlice, 16);
    const winningIndex = rawDecimal % eligibleMembers.length;
    const winner = eligibleMembers[winningIndex];

    const proof = {
      drawId,
      ekubId,
      ekubName: ekubData.name,
      cycleId: `cycle-${cycleNumber}`,
      cycleNumber,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      hashResult,
      rawDecimal: rawDecimal.toString(),
      eligibleCount: eligibleMembers.length,
      winningIndex,
      winnerId: winner.userId || winner.id,
      winnerName: winner.displayName || winner.name || 'Anonymous Member',
      payoutAmount,
      explanation: `Index calculated by (parseInt(HMAC_SHA256(serverSeed, "${clientSeed}:${nonce}:${cycleNumber}")[0..12], 16) % ${eligibleMembers.length}) = ${winningIndex}`,
      timestamp: new Date().toISOString(),
    };

    const newDraw = {
      id: drawId,
      ekubId,
      ekubName: ekubData.name,
      cycleId: `cycle-${cycleNumber}`,
      cycleNumber,
      winnerId: winner.userId || winner.id,
      winnerName: winner.displayName || winner.name,
      payoutAmount,
      drawnAt: new Date().toISOString(),
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      verificationHash: hashResult,
      eligibleMemberCount: eligibleMembers.length,
      verificationProof: proof,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    const newPayout = {
      id: payoutId,
      ekubId,
      ekubName: ekubData.name,
      cycleId: `cycle-${cycleNumber}`,
      cycleNumber,
      drawId,
      winnerId: winner.userId || winner.id,
      winnerName: winner.displayName || winner.name,
      amount: payoutAmount,
      currency: 'ETB',
      status: 'documents_required',
      requiredDocuments: ['National ID / Kebele ID', 'Bank Account / Telebirr Confirmation'],
      createdAt: new Date().toISOString(),
    };

    const payoutRef = ekubRef.collection('payouts').doc(payoutId);
    const winnerMemberRef = ekubRef.collection('members').doc(winner.userId || winner.id);

    transaction.set(drawRef, newDraw);
    transaction.set(payoutRef, newPayout);
    transaction.update(winnerMemberRef, {
      hasReceivedPayout: true,
      eligibleForDraw: false,
    });
    // Advance the cycle so a subsequent draw call targets a new,
    // not-yet-drawn cycle number instead of colliding with this one.
    transaction.update(ekubRef, {
      lastDrawDate: new Date().toISOString(),
      currentCycle: cycleNumber + 1,
    });

    return { newDraw, newPayout, winner, proof, cycleNumber };
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'DRAW_EXECUTED',
    entityType: 'draw',
    entityId: result.newDraw.id,
    ekubId,
    reason: `Cryptographic live draw executed for ${result.newDraw.ekubName} Cycle #${result.cycleNumber}. Winner: ${result.winner.displayName}`,
    newState: { winnerId: result.winner.userId || result.winner.id, winningIndex: result.proof.winningIndex, hashResult: result.proof.hashResult },
  });

  return {
    success: true,
    draw: result.newDraw,
    payout: result.newPayout,
    winner: result.winner,
    proof: result.proof,
  };
});

// ============================================================================
// 6. APPROVE PAYOUT / DISBURSE PAYOUT (Super Admin or Ekub Admin)
// ============================================================================
export const approvePayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, payoutId } = data;
  if (!ekubId || !payoutId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and payoutId are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const payoutRef = db.collection('ekubs').doc(ekubId).collection('payouts').doc(payoutId);

  // State-transition guard inside a transaction: only a payout currently
  // awaiting approval can be approved. This prevents two concurrent/repeat
  // calls from both "succeeding" against the same payout (e.g. re-approving
  // one that's already been paid).
  const payoutData = await db.runTransaction(async (transaction) => {
    const payoutDoc = await transaction.get(payoutRef);
    if (!payoutDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Payout ${payoutId} not found.`);
    }
    const data = payoutDoc.data()!;
    if (data.status !== 'documents_required' && data.status !== 'under_review') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Payout is currently '${data.status}' and cannot be approved from this state.`
      );
    }
    transaction.update(payoutRef, {
      status: 'approved',
      approvedBy: context.auth!.uid,
      approvedAt: new Date().toISOString(),
    });
    return data;
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'PAYOUT_APPROVED',
    entityType: 'payout',
    entityId: payoutId,
    ekubId,
    reason: `Payout of ${payoutData.amount} ETB approved for disbursement to ${payoutData.winnerName}`,
    newState: { status: 'approved', approvedBy: context.auth.uid },
  });

  return { success: true, message: 'Payout approved for bank disbursement.' };
});

export const disbursePayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, payoutId, paymentReference } = data;
  if (!ekubId || !payoutId || !paymentReference) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId, payoutId, and paymentReference are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const payoutRef = db.collection('ekubs').doc(ekubId).collection('payouts').doc(payoutId);

  // State-transition guard: only an 'approved' payout can be disbursed, and
  // only once. Without this, two concurrent/repeat calls could both mark
  // the same payout 'paid' with two different payment references, silently
  // overwriting the record of what was actually sent.
  const payoutData = await db.runTransaction(async (transaction) => {
    const payoutDoc = await transaction.get(payoutRef);
    if (!payoutDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Payout ${payoutId} not found.`);
    }
    const data = payoutDoc.data()!;
    if (data.status !== 'approved') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Payout is currently '${data.status}' and must be 'approved' before it can be disbursed.`
      );
    }
    transaction.update(payoutRef, {
      status: 'paid',
      paymentReference,
      processedAt: new Date().toISOString(),
      disbursedBy: context.auth!.uid,
    });
    return data;
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'PAYOUT_DISBURSED',
    entityType: 'payout',
    entityId: payoutId,
    ekubId,
    reason: `Direct bank wire transfer completed with reference ${paymentReference} for ${payoutData.amount} ETB`,
    newState: { status: 'paid', paymentReference },
  });

  return { success: true, message: `Payout disbursed with reference ${paymentReference}.` };
});

// ============================================================================
// 7. APPROVE MEMBERSHIP REQUEST (Super Admin or Ekub Admin)
// A prospective member self-requests to join (client writes their own
// members/{uid} doc directly with status: 'pending' -- allowed by
// firestore.rules). This function is how an Ekub Admin/Super Admin accepts
// that request: it must go through a Cloud Function (not a direct client
// update) because it also increments the Ekub's currentMemberCount, which
// is not in the client-updatable field list for Ekub Admins.
// ============================================================================
export const approveMembershipRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, userId } = data;
  if (!ekubId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and userId are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const ekubRef = db.collection('ekubs').doc(ekubId);
  const memberRef = ekubRef.collection('members').doc(userId);

  await db.runTransaction(async (transaction) => {
    const memberDoc = await transaction.get(memberRef);
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'No membership request found for this user.');
    }
    const memberData = memberDoc.data()!;
    if (memberData.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', `This member is already '${memberData.status}', not pending.`);
    }
    transaction.update(memberRef, {
      status: 'active',
      eligibleForDraw: true,
      updatedAt: new Date().toISOString(),
    });
    transaction.update(ekubRef, {
      currentMemberCount: admin.firestore.FieldValue.increment(1),
    });
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'MEMBERSHIP_APPROVED',
    entityType: 'member',
    entityId: userId,
    ekubId,
    reason: `Membership request approved for user ${userId}`,
    newState: { status: 'active' },
  });

  return { success: true, message: 'Membership request approved.' };
});

// ============================================================================
// 8. REMOVE EKUB MEMBER (Super Admin or Ekub Admin)
// Used both to reject a still-pending request and to remove an existing
// active member. currentMemberCount is only decremented if the member being
// removed was actually 'active' (a pending request was never counted).
// ============================================================================
export const removeEkubMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { ekubId, userId } = data;
  if (!ekubId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'ekubId and userId are required.');
  }

  const { isSuper } = await checkIsEkubAdminOrSuperAdmin(context.auth.uid, ekubId, context.auth);

  const ekubRef = db.collection('ekubs').doc(ekubId);
  const memberRef = ekubRef.collection('members').doc(userId);

  const removedMember = await db.runTransaction(async (transaction) => {
    const memberDoc = await transaction.get(memberRef);
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'That member does not exist in this Ekub.');
    }
    const memberData = memberDoc.data()!;
    if (memberData.role === 'admin') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'The current Ekub Admin cannot be removed as a member -- reassign the Ekub Admin first.'
      );
    }
    transaction.delete(memberRef);
    if (memberData.status === 'active') {
      transaction.update(ekubRef, {
        currentMemberCount: admin.firestore.FieldValue.increment(-1),
      });
    }
    return memberData;
  });

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: removedMember.status === 'pending' ? 'MEMBERSHIP_REQUEST_REJECTED' : 'MEMBER_REMOVED',
    entityType: 'member',
    entityId: userId,
    ekubId,
    reason: removedMember.status === 'pending'
      ? `Membership request rejected for ${removedMember.displayName || userId}`
      : `Member ${removedMember.displayName || userId} removed from Ekub`,
    previousState: { status: removedMember.status },
  });

  return { success: true, message: 'Member removed.' };
});

// ============================================================================
// 9. INVITE MEMBER TO THE PLATFORM (Super Admin, or any Ekub Admin)
//
// Public self-registration has been removed (see AuthContext.tsx and the
// users/{userId} create rule in firestore.rules). This is now the ONLY way
// a new 'member' account gets created: it pre-creates the Firebase Auth
// user (via the Admin SDK, which bypasses client-side rules) AND their
// Firestore profile in one step, then returns a password-reset link the
// inviting admin can share with the person directly (WhatsApp, SMS, email,
// etc.) -- there is no automatic email-sending configured here.
// ============================================================================
export const inviteMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { email, fullName, phoneNumber } = data;
  if (!email || !fullName) {
    throw new functions.https.HttpsError('invalid-argument', 'email and fullName are required.');
  }

  const isSuper = await checkIsSuperAdmin(context.auth.uid, context.auth);
  let isAnyEkubAdmin = false;
  if (!isSuper) {
    const adminEkubsSnap = await db.collection('ekubs').where('adminId', '==', context.auth.uid).limit(1).get();
    isAnyEkubAdmin = !adminEkubsSnap.empty;
  }
  if (!isSuper && !isAnyEkubAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the Super Admin or an Ekub Admin can invite new members.'
    );
  }

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    const existingProfile = await db.collection('users').doc(userRecord.uid).get();
    if (existingProfile.exists) {
      throw new functions.https.HttpsError('already-exists', 'A YegnaEkub account for this email already exists.');
    }
    // Auth account exists but has no Firestore profile yet (e.g. a prior
    // partial invite) -- fall through and create the profile below.
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    if (err.code === 'auth/user-not-found') {
      userRecord = await admin.auth().createUser({
        email,
        displayName: fullName,
        emailVerified: false,
      });
    } else {
      throw new functions.https.HttpsError('internal', 'Failed to look up or create the user account.');
    }
  }

  const newProfile = {
    uid: userRecord.uid,
    fullName,
    email,
    phoneNumber: phoneNumber || '',
    photoURL: '',
    role: 'member',
    preferredLanguage: 'en',
    preferredPaymentMethod: 'telebirr',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  };
  await db.collection('users').doc(userRecord.uid).set(newProfile);

  const resetLink = await admin.auth().generatePasswordResetLink(email);

  await writeAuditLog({
    actorId: context.auth.uid,
    actorName: isSuper ? 'Super Admin' : 'Ekub Admin',
    actorRole: isSuper ? 'super_admin' : 'admin',
    action: 'MEMBER_INVITED',
    entityType: 'admin',
    entityId: userRecord.uid,
    reason: `Invited ${email} to the platform`,
    newState: { email, fullName },
  });

  return { success: true, uid: userRecord.uid, resetLink };
});
