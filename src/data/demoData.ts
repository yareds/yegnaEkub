import { Ekub, EkubMember, Contribution, Draw, Payout, AppNotification, AuditLog, UserProfile } from '../types';

// ============================================================================
// Demo Mode dataset -- modeled on the three sample circles (Bole Daily
// Savers, Merkato Weekly Circle, Piazza Monthly Cooperative) that were
// previously generated as REAL Firestore data via "Generate Sample Data".
// That feature is gone now -- everything below is static, local-only data
// used exclusively by Demo Mode (see App.tsx), and none of it is ever read
// from or written to Firebase.
// ============================================================================

const SAMPLE_NAMES = [
  'Rahel Getachew', 'Mekdes Wolde', 'Kaleb Mulugeta', 'Frehiwot Desta', 'Nathnael Yilma',
  'Bethlehem Ashenafi', 'Amanuel Zerihun', 'Eyerusalem Kebede', 'Robel Teshome', 'Sara Endale',
  'Yohannes Tadesse', 'Hana Girma', 'Bereket Haile', 'Tigist Worku', 'Solomon Fikre',
  'Lidya Tsegaye', 'Henok Abera', 'Marta Dubale', 'Fitsum Negash', 'Kidist Belay',
  'Samuel Gebre', 'Wubit Alemayehu', 'Biniam Tesema', 'Meaza Shiferaw', 'Girum Yohannes',
  'Meron Assefa',
];

interface CircleSeed {
  ekubId: string;
  name: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  memberLimit: number;
  contributionAmount: number;
  adminUid: string;
  adminName: string;
  currentCycle: number;
  status: Ekub['status'];
  startDate: string;
  cycle1Winner?: { userId: string; name: string };
}

const CIRCLES: CircleSeed[] = [
  {
    ekubId: 'demo-ekub-bole-daily',
    name: 'Bole Daily Savers',
    description: 'A fast-cycle daily contribution circle for small, frequent savers.',
    frequency: 'daily',
    memberLimit: 10,
    contributionAmount: 500,
    adminUid: 'demo-admin-bole',
    adminName: 'Abebe Bekele',
    currentCycle: 1,
    status: 'recruiting',
    startDate: '2026-08-24',
  },
  {
    ekubId: 'demo-ekub-merkato-weekly',
    name: 'Merkato Weekly Circle',
    description: 'A weekly rotating savings circle for Merkato traders.',
    frequency: 'weekly',
    memberLimit: 20,
    contributionAmount: 2000,
    adminUid: 'demo-admin-merkato',
    adminName: 'Selamawit Tesfaye',
    currentCycle: 2,
    status: 'active',
    startDate: '2026-08-10',
    cycle1Winner: { userId: 'demo-merkato-member-25', name: 'Meron Assefa' },
  },
  {
    ekubId: 'demo-ekub-piazza-monthly',
    name: 'Piazza Monthly Cooperative',
    description: 'A larger monthly cooperative for long-term collective saving.',
    frequency: 'monthly',
    memberLimit: 30,
    contributionAmount: 5000,
    adminUid: 'demo-admin-piazza',
    adminName: 'Dawit Alemu',
    currentCycle: 1,
    status: 'active',
    startDate: '2026-08-01',
  },
];

const nextDate = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

export const DEMO_EKUBS: Ekub[] = CIRCLES.map((c) => ({
  id: c.ekubId,
  name: c.name,
  description: c.description,
  adminId: c.adminUid,
  adminName: c.adminName,
  organizerId: c.adminUid,
  organizerName: c.adminName,
  status: c.status,
  contributionAmount: c.contributionAmount,
  currency: 'ETB',
  frequency: c.frequency,
  memberLimit: c.memberLimit,
  currentMemberCount: c.status === 'recruiting' ? 2 : c.memberLimit,
  startDate: c.startDate,
  nextContributionDate: nextDate(2),
  nextDrawDate: nextDate(5),
  payoutAmount: c.contributionAmount * c.memberLimit,
  currentCycle: c.currentCycle,
  totalCycles: c.memberLimit,
  isPrivate: false,
  rules: 'Contributions verified against uploaded receipts. Draws use server-side HMAC-SHA256 randomness.',
  acceptedPaymentMethods: ['telebirr', 'cbe'],
  createdAt: '2026-08-01T09:00:00Z',
}));

function buildMembers(c: CircleSeed): EkubMember[] {
  const activeCount = c.status === 'recruiting' ? 2 : c.memberLimit;
  const members: EkubMember[] = [
    {
      userId: c.adminUid,
      displayName: c.adminName,
      role: 'admin',
      status: 'active',
      joinedAt: `${c.startDate}T09:00:00Z`,
      contributionStatus: 'paid',
      eligibleForDraw: true,
      hasReceivedPayout: false,
      totalContributed: c.contributionAmount,
      lastContributionDate: nextDate(-2),
    },
  ];
  for (let i = 0; i < activeCount - 1; i++) {
    const userId = `demo-${c.ekubId.replace('demo-ekub-', '')}-member-${i}`;
    const name = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
    members.push({
      userId,
      displayName: name,
      role: 'member',
      status: 'active',
      joinedAt: `${c.startDate}T10:00:00Z`,
      contributionStatus: i % 3 === 0 ? 'pending' : 'paid',
      eligibleForDraw: true,
      hasReceivedPayout: false,
      totalContributed: i % 3 === 0 ? 0 : c.contributionAmount,
      lastContributionDate: i % 3 === 0 ? undefined : nextDate(-2),
    });
  }
  // Ensure the designated cycle-1 winner is present with the exact ID used
  // in the Draw/Payout records below, replacing one generated member so
  // there's no duplicate and the winner shows up correctly everywhere.
  if (c.cycle1Winner) {
    const replaceIdx = members.length > 1 ? 1 : 0;
    members[replaceIdx] = {
      userId: c.cycle1Winner.userId,
      displayName: c.cycle1Winner.name,
      role: replaceIdx === 0 ? members[0].role : 'member',
      status: 'active',
      joinedAt: `${c.startDate}T10:00:00Z`,
      contributionStatus: 'paid',
      eligibleForDraw: false,
      hasReceivedPayout: true,
      totalContributed: c.contributionAmount,
      lastContributionDate: nextDate(-2),
    };
  }
  return members;
}

export const DEMO_MEMBERS: Record<string, EkubMember[]> = Object.fromEntries(
  CIRCLES.map((c) => [c.ekubId, buildMembers(c)])
);

// Used by getAllUsers() in Demo Mode -- so admin-assignment pickers show
// something sensible while browsing, even though nothing can actually be
// submitted (writes are blocked entirely in Demo Mode).
export const DEMO_USERS: UserProfile[] = CIRCLES.map((c) => ({
  uid: c.adminUid,
  fullName: c.adminName,
  email: `admin.${c.ekubId.replace('demo-ekub-', '').replace(/-/g, '.')}@yegnaekub-demo.et`,
  phoneNumber: '',
  photoURL: '',
  role: 'member',
  preferredLanguage: 'en',
  verificationStatus: 'verified',
  createdAt: '2026-08-01T09:00:00Z',
} as UserProfile));

export const DEMO_CONTRIBUTIONS: Contribution[] = CIRCLES.flatMap((c) => {
  const members = DEMO_MEMBERS[c.ekubId].filter(m => m.contributionStatus === 'paid');
  return members.slice(0, 4).map((m, idx) => ({
    id: `demo-contrib-${c.ekubId}-${idx}`,
    userId: m.userId,
    userName: m.displayName,
    userEmail: `${m.displayName.toLowerCase().replace(/\s+/g, '.')}@example.et`,
    ekubId: c.ekubId,
    ekubName: c.name,
    cycleId: `${c.ekubId}-cycle-${c.currentCycle}`,
    cycleNumber: c.currentCycle,
    amount: c.contributionAmount,
    currency: 'ETB' as const,
    paymentMethod: 'telebirr' as const,
    receiptUrl: '',
    transactionReference: `DEMO-${c.ekubId.slice(-4).toUpperCase()}-${idx}`,
    status: 'verified' as const,
    submittedAt: nextDate(-3),
    verifiedAt: nextDate(-2),
    verifiedBy: c.adminUid,
    verifiedByName: c.adminName,
    createdAt: nextDate(-3),
  }));
});

export const DEMO_DRAWS: Draw[] = CIRCLES.filter(c => c.cycle1Winner).flatMap((c) => {
  const winner = c.cycle1Winner!;
  const eligibleIds = DEMO_MEMBERS[c.ekubId].map(m => m.userId);
  return [{
    id: `demo-draw-${c.ekubId}-cycle-1`,
    ekubId: c.ekubId,
    ekubName: c.name,
    cycleId: `${c.ekubId}-cycle-1`,
    cycleNumber: 1,
    drawNumber: 1,
    status: 'completed' as const,
    scheduledAt: nextDate(-5),
    executedAt: nextDate(-5),
    eligibleMemberIds: eligibleIds,
    eligibleMemberCount: eligibleIds.length,
    winnerId: winner.userId,
    winnerName: winner.name,
    payoutAmount: c.contributionAmount * c.memberLimit,
    randomnessMethod: 'HMAC-SHA256',
    serverSeedHash: '6c281aa9002fc7aff28fd8a3b9e1c4d7f0a2b5e8c6d9f1a3b7e0c2d4f6a8b1c3',
    verificationHash: '6c281aa9002fc7aff28fd8a3b9e1c4d7f0a2b5e8c6d9f1a3b7e0c2d4f6a8b1c3',
    createdAt: nextDate(-5),
  }];
});

export const DEMO_PAYOUTS: Payout[] = DEMO_DRAWS.map((d, idx) => ({
  id: `demo-payout-${idx}`,
  ekubId: d.ekubId,
  ekubName: d.ekubName,
  cycleId: d.cycleId,
  cycleNumber: d.cycleNumber,
  drawId: d.id,
  winnerId: d.winnerId!,
  winnerName: d.winnerName!,
  amount: d.payoutAmount,
  currency: 'ETB' as const,
  status: 'paid' as const,
  requiredDocuments: [],
  createdAt: nextDate(-5),
}));

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'demo-notif-1',
    userId: 'demo-admin-merkato',
    title: 'Draw Completed',
    message: 'Meron Assefa won Cycle #1 of Merkato Weekly Circle -- 40,000 ETB.',
    type: 'draw_completed' as const,
    read: false,
    createdAt: nextDate(-5),
  } as AppNotification,
];

export const DEMO_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'demo-audit-1',
    actorId: 'demo-super-admin',
    actorName: 'Demo Super Admin',
    actorRole: 'super_admin',
    action: 'EKUB_CREATED',
    entityType: 'ekub',
    entityId: 'demo-ekub-merkato-weekly',
    reason: 'Created Merkato Weekly Circle with Selamawit Tesfaye as Admin',
    timestamp: nextDate(-10),
  } as AuditLog,
];

export const ETHIOPIAN_BANK_ACCOUNTS = [
  {
    code: 'telebirr',
    name: 'Telebirr',
    accountNumber: '0911849284',
    accountName: 'YegnaEkub Trust',
    instructions: 'Send via Telebirr app to 0911849284 and upload the confirmation screenshot.',
    badgeColor: 'bg-green-600 text-white',
  },
  {
    code: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    accountNumber: '1000482910492',
    accountName: 'YegnaEkub Trust Account',
    instructions: 'Transfer via CBE Mobile Banking or branch deposit, then upload the receipt.',
    badgeColor: 'bg-yellow-600 text-white',
  },
  {
    code: 'cbe_birr',
    name: 'CBE Birr',
    accountNumber: '0911849284',
    accountName: 'YegnaEkub Trust',
    instructions: 'Use CBE Birr USSD *847# or CBE Birr App to transfer to 0911849284.',
    badgeColor: 'bg-purple-600 text-white',
  },
  {
    code: 'dashen',
    name: 'Dashen Bank (Amole)',
    accountNumber: '582910492810',
    accountName: 'YegnaEkub Trust',
    instructions: 'Transfer through Amole or Dashen Mobile App. Note your reference code on the confirmation receipt.',
    badgeColor: 'bg-blue-800 text-white',
  },
  {
    code: 'abyssinia',
    name: 'Bank of Abyssinia',
    accountNumber: '482910492819',
    accountName: 'YegnaEkub Trust Account',
    instructions: 'Transfer through BOA Mobile App and screenshot the PDF transaction receipt.',
    badgeColor: 'bg-amber-800 text-white',
  },
];
