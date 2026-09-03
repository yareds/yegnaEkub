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
  'Senait Desta', 'Mekdes Wolde', 'Kaleb Mulugeta', 'Frehiwot Desta', 'Nathnael Yilma',
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
  inviteCode: c.ekubId === 'demo-ekub-bole-daily' ? 'BOLE24' : c.ekubId === 'demo-ekub-merkato-weekly' ? 'MEK009' : 'PIAZZA',
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
  const circleKey = c.ekubId.replace('demo-ekub-', '');
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
      phoneNumber: '+251 91 100 0001',
    },
  ];

  for (let i = 0; i < activeCount - 1; i++) {
    // Member Persona Scoping:
    // Rahel Getachew can belong to TWO different Ekub circles (Merkato and Piazza),
    // but under distinct per-Ekub login accounts!
    // - Merkato Account: 'demo-rahel-merkato' (rahel.merkato@example.et)
    // - Piazza Account: 'demo-rahel-piazza' (rahel.piazza@example.et)
    // - Bole Savers: 'demo-kaleb-bole' (kaleb.bole@example.et)
    let userId = `demo-${circleKey}-member-${i}`;
    let name = SAMPLE_NAMES[(i + 1) % SAMPLE_NAMES.length];
    let phone = `+251 91 ${100 + i} ${String(1000 + i * 37).slice(-4)}`;

    if (i === 0) {
      if (c.ekubId === 'demo-ekub-merkato-weekly') {
        userId = 'demo-rahel-merkato';
        name = 'Rahel Getachew';
        phone = '+251 91 100 0002';
      } else if (c.ekubId === 'demo-ekub-piazza-monthly') {
        userId = 'demo-rahel-piazza';
        name = 'Rahel Getachew';
        phone = '+251 91 100 0002';
      } else if (c.ekubId === 'demo-ekub-bole-daily') {
        userId = 'demo-kaleb-bole';
        name = 'Kaleb Mulugeta';
        phone = '+251 91 100 0003';
      }
    }
    
    // Create rich variation of contribution statuses:
    // Index 0, 4, 8: Overdue (past due date)
    // Index 1, 5, 9: Due soon (3-day SMS sent)
    // Index 2, 6, 10: Paid
    // Index 3, 7, 11: Upcoming
    let contribStatus: EkubMember['contributionStatus'] = 'paid';
    let eligible = true;
    let daysOverdue: number | undefined = undefined;
    let lastSmsReminderDate: string | undefined = undefined;
    let lastSmsReminderType: EkubMember['lastSmsReminderType'] = undefined;
    let cycleDueDate: string | undefined = undefined;

    if (i === 0) {
      // Demo Member persona (Rahel Getachew / Kaleb Mulugeta) - active, up to date with verified payments
      contribStatus = 'paid';
      eligible = true;
      cycleDueDate = nextDate(2);
    } else if (i % 4 === 0) {
      contribStatus = 'overdue';
      eligible = false;
      daysOverdue = 2;
      cycleDueDate = nextDate(-2);
      lastSmsReminderDate = nextDate(-1);
      lastSmsReminderType = 'overdue_alert';
    } else if (i % 4 === 1) {
      contribStatus = 'due';
      eligible = true;
      cycleDueDate = nextDate(2);
      lastSmsReminderDate = nextDate(-1);
      lastSmsReminderType = '3_day_reminder';
    } else if (i % 4 === 2) {
      contribStatus = 'paid';
      eligible = true;
      cycleDueDate = nextDate(2);
    } else {
      contribStatus = 'pending';
      eligible = true;
      cycleDueDate = nextDate(7);
    }

    members.push({
      userId,
      displayName: name,
      phoneNumber: phone,
      role: 'member',
      status: 'active',
      joinedAt: `${c.startDate}T10:00:00Z`,
      contributionStatus: contribStatus,
      eligibleForDraw: eligible,
      hasReceivedPayout: false,
      totalContributed: contribStatus === 'paid' ? c.contributionAmount : 0,
      lastContributionDate: contribStatus === 'paid' ? nextDate(-2) : undefined,
      daysOverdue,
      lastSmsReminderDate,
      lastSmsReminderType,
      cycleDueDate,
    });
  }

  // Ensure the designated cycle-1 winner is present with the exact ID used
  // in the Draw/Payout records, replacing an auxiliary member so the active
  // member persona (at index 1) is never overwritten.
  if (c.cycle1Winner) {
    const replaceIdx = members.length > 3 ? 3 : (members.length > 2 ? 2 : 1);
    members[replaceIdx] = {
      userId: c.cycle1Winner.userId,
      displayName: c.cycle1Winner.name,
      phoneNumber: '+251 91 199 8877',
      role: 'member',
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

// Used by getAllUsers() in Demo Mode -- representing distinct per-Ekub login accounts
export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'demo-super-admin',
    fullName: 'Demo Super Admin',
    email: 'super-admin@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0000',
    role: 'super_admin',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-01T09:00:00Z',
  },
  {
    uid: 'demo-admin-merkato',
    fullName: 'Selamawit Tesfaye',
    email: 'admin.merkato.weekly@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0001',
    role: 'member',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-01T09:00:00Z',
  },
  {
    uid: 'demo-admin-piazza',
    fullName: 'Dawit Alemu',
    email: 'admin.piazza.monthly@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0005',
    role: 'member',
    ekubId: 'demo-ekub-piazza-monthly',
    ekubName: 'Piazza Monthly Cooperative',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-01T09:00:00Z',
  },
  {
    uid: 'demo-rahel-merkato',
    fullName: 'Rahel Getachew',
    email: 'rahel.merkato@example.et',
    phoneNumber: '+251 91 100 0002',
    role: 'member',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-10T10:00:00Z',
  },
  {
    uid: 'demo-rahel-piazza',
    fullName: 'Rahel Getachew',
    email: 'rahel.piazza@example.et',
    phoneNumber: '+251 91 100 0002',
    role: 'member',
    ekubId: 'demo-ekub-piazza-monthly',
    ekubName: 'Piazza Monthly Cooperative',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    uid: 'demo-kaleb-bole',
    fullName: 'Kaleb Mulugeta',
    email: 'kaleb.bole@example.et',
    phoneNumber: '+251 91 100 0003',
    role: 'member',
    ekubId: 'demo-ekub-bole-daily',
    ekubName: 'Bole Daily Savers',
    preferredLanguage: 'en',
    verificationStatus: 'verified',
    createdAt: '2026-08-24T10:00:00Z',
  },
];

export const DEMO_CONTRIBUTIONS: Contribution[] = [
  // Rahel Getachew - Merkato Weekly Circle Account
  {
    id: 'demo-contrib-rahel-merkato-c1',
    userId: 'demo-rahel-merkato',
    userName: 'Rahel Getachew',
    userEmail: 'rahel.merkato@example.et',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    cycleId: 'demo-ekub-merkato-weekly-cycle-1',
    cycleNumber: 1,
    amount: 2000,
    currency: 'ETB',
    paymentMethod: 'telebirr',
    receiptUrl: '',
    transactionReference: 'TB-982348102',
    status: 'verified',
    submittedAt: nextDate(-12),
    verifiedAt: nextDate(-11),
    verifiedBy: 'demo-admin-merkato',
    verifiedByName: 'Selamawit Tesfaye',
    createdAt: nextDate(-12),
  },
  {
    id: 'demo-contrib-rahel-merkato-c2',
    userId: 'demo-rahel-merkato',
    userName: 'Rahel Getachew',
    userEmail: 'rahel.merkato@example.et',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    cycleId: 'demo-ekub-merkato-weekly-cycle-2',
    cycleNumber: 2,
    amount: 2000,
    currency: 'ETB',
    paymentMethod: 'cbe',
    receiptUrl: '',
    transactionReference: 'CBE-FT26248910',
    status: 'verified',
    submittedAt: nextDate(-2),
    verifiedAt: nextDate(-1),
    verifiedBy: 'demo-admin-merkato',
    verifiedByName: 'Selamawit Tesfaye',
    createdAt: nextDate(-2),
  },
  // Rahel Getachew - Piazza Monthly Cooperative Account (Separate Login!)
  {
    id: 'demo-contrib-rahel-piazza-c1',
    userId: 'demo-rahel-piazza',
    userName: 'Rahel Getachew',
    userEmail: 'rahel.piazza@example.et',
    ekubId: 'demo-ekub-piazza-monthly',
    ekubName: 'Piazza Monthly Cooperative',
    cycleId: 'demo-ekub-piazza-monthly-cycle-1',
    cycleNumber: 1,
    amount: 5000,
    currency: 'ETB',
    paymentMethod: 'cbe',
    receiptUrl: '',
    transactionReference: 'CBE-PZ-991284',
    status: 'verified',
    submittedAt: nextDate(-10),
    verifiedAt: nextDate(-9),
    verifiedBy: 'demo-admin-piazza',
    verifiedByName: 'Dawit Alemu',
    createdAt: nextDate(-10),
  },
  // Kaleb Mulugeta - Bole Daily Savers Account
  {
    id: 'demo-contrib-kaleb-bole-c1',
    userId: 'demo-kaleb-bole',
    userName: 'Kaleb Mulugeta',
    userEmail: 'kaleb.bole@example.et',
    ekubId: 'demo-ekub-bole-daily',
    ekubName: 'Bole Daily Savers',
    cycleId: 'demo-ekub-bole-daily-cycle-1',
    cycleNumber: 1,
    amount: 500,
    currency: 'ETB',
    paymentMethod: 'telebirr',
    receiptUrl: '',
    transactionReference: 'TB-BL-102934',
    status: 'verified',
    submittedAt: nextDate(-1),
    verifiedAt: nextDate(-1),
    verifiedBy: 'demo-admin-bole',
    verifiedByName: 'Abebe Bekele',
    createdAt: nextDate(-1),
  },
  // Additional circle member contributions
  ...CIRCLES.flatMap((c) => {
    const members = DEMO_MEMBERS[c.ekubId].filter(
      m => m.contributionStatus === 'paid' && 
      m.userId !== 'demo-rahel-merkato' && 
      m.userId !== 'demo-rahel-piazza' && 
      m.userId !== 'demo-kaleb-bole' && 
      m.role !== 'admin'
    );
    return members.slice(0, 5).map((m, idx) => ({
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
      paymentMethod: (idx % 2 === 0 ? 'telebirr' : 'cbe') as 'telebirr' | 'cbe',
      receiptUrl: '',
      transactionReference: `DEMO-${c.ekubId.slice(-4).toUpperCase()}-${1000 + idx}`,
      status: 'verified' as const,
      submittedAt: nextDate(-3),
      verifiedAt: nextDate(-2),
      verifiedBy: c.adminUid,
      verifiedByName: c.adminName,
      createdAt: nextDate(-3),
    }));
  })
];

export const DEMO_DRAWS: Draw[] = [
  {
    id: 'demo-draw-merkato-cycle-1',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    cycleId: 'demo-ekub-merkato-weekly-cycle-1',
    cycleNumber: 1,
    drawNumber: 1,
    status: 'completed',
    scheduledAt: nextDate(-7),
    executedAt: nextDate(-7),
    eligibleMemberIds: (DEMO_MEMBERS['demo-ekub-merkato-weekly'] || []).map(m => m.userId),
    eligibleMemberCount: 20,
    winnerId: 'demo-merkato-member-25',
    winnerName: 'Meron Assefa',
    payoutAmount: 40000,
    randomnessMethod: 'HMAC-SHA256',
    serverSeedHash: '6c281aa9002fc7aff28fd8a3b9e1c4d7f0a2b5e8c6d9f1a3b7e0c2d4f6a8b1c3',
    verificationHash: '9e41b2c87a1d3f6e5b0c8d4a2f1e9c7b3a5d8f2e1c4b7a9d0f3e6c8b1a4d7f2',
    createdAt: nextDate(-7),
  },
  {
    id: 'demo-draw-piazza-cycle-1',
    ekubId: 'demo-ekub-piazza-monthly',
    ekubName: 'Piazza Monthly Cooperative',
    cycleId: 'demo-ekub-piazza-monthly-cycle-1',
    cycleNumber: 1,
    drawNumber: 1,
    status: 'completed',
    scheduledAt: nextDate(-14),
    executedAt: nextDate(-14),
    eligibleMemberIds: (DEMO_MEMBERS['demo-ekub-piazza-monthly'] || []).map(m => m.userId),
    eligibleMemberCount: 30,
    winnerId: 'demo-piazza-member-14',
    winnerName: 'Solomon Fikre',
    payoutAmount: 150000,
    randomnessMethod: 'HMAC-SHA256',
    serverSeedHash: 'f4d92a18c7b3e0c4a8f1d2e5b7c9a3f0e2b4d6a8c1f3e5b7a9d2c4f6b8e0a1c3',
    verificationHash: '3a7c1e9b2f4d6a8c0e2b4d6a8f1c3e5b7a9d2c4f6b8e0a1c3f5d7b9e1a3c5e7',
    createdAt: nextDate(-14),
  }
];

export const DEMO_PAYOUTS: Payout[] = [
  {
    id: 'demo-payout-merkato-1',
    ekubId: 'demo-ekub-merkato-weekly',
    ekubName: 'Merkato Weekly Circle',
    cycleId: 'demo-ekub-merkato-weekly-cycle-1',
    cycleNumber: 1,
    drawId: 'demo-draw-merkato-cycle-1',
    winnerId: 'demo-merkato-member-25',
    winnerName: 'Meron Assefa',
    amount: 40000,
    currency: 'ETB',
    status: 'paid',
    requiredDocuments: [],
    createdAt: nextDate(-7),
  },
  {
    id: 'demo-payout-piazza-1',
    ekubId: 'demo-ekub-piazza-monthly',
    ekubName: 'Piazza Monthly Cooperative',
    cycleId: 'demo-ekub-piazza-monthly-cycle-1',
    cycleNumber: 1,
    drawId: 'demo-draw-piazza-cycle-1',
    winnerId: 'demo-piazza-member-14',
    winnerName: 'Solomon Fikre',
    amount: 150000,
    currency: 'ETB',
    status: 'paid',
    requiredDocuments: [],
    createdAt: nextDate(-14),
  }
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  // Rahel Getachew - Merkato Weekly Circle Account
  {
    id: 'demo-notif-rahel-merkato-1',
    userId: 'demo-rahel-merkato',
    title: 'Payment Slip Verified',
    message: 'Your Cycle #2 contribution of 2,000 ETB for "Merkato Weekly Circle" has been verified by Selamawit Tesfaye. You are eligible for the upcoming draw!',
    type: 'payment_verified',
    read: false,
    channel: 'in_app',
    createdAt: nextDate(-1),
  },
  {
    id: 'demo-notif-rahel-merkato-2',
    userId: 'demo-rahel-merkato',
    title: 'SMS: 3-Day Contribution Reminder',
    message: '[YegnaEkub SMS] Reminder: Your contribution of 2,000 ETB for "Merkato Weekly Circle" (Cycle #2) is due in 3 days. Please submit via Telebirr or CBE.',
    type: 'contribution_reminder',
    read: false,
    channel: 'sms',
    recipientPhone: '+251 91 100 0002',
    smsDelivered: true,
    smsSentAt: nextDate(-2),
    daysBeforeDue: 3,
    createdAt: nextDate(-2),
  },
  {
    id: 'demo-notif-rahel-merkato-3',
    userId: 'demo-rahel-merkato',
    title: 'Draw Completed: Cycle #1',
    message: 'Meron Assefa was selected as the winner for Cycle #1 of Merkato Weekly Circle (40,000 ETB). Cryptographic proof is verifiable.',
    type: 'draw_completed',
    read: true,
    channel: 'both',
    createdAt: nextDate(-7),
  },
  // Rahel Getachew - Piazza Monthly Cooperative Account (Separate Login!)
  {
    id: 'demo-notif-rahel-piazza-1',
    userId: 'demo-rahel-piazza',
    title: 'Payment Slip Verified',
    message: 'Your Cycle #1 contribution of 5,000 ETB for "Piazza Monthly Cooperative" has been verified by Dawit Alemu. You are eligible for the next cycle draw!',
    type: 'payment_verified',
    read: false,
    channel: 'in_app',
    createdAt: nextDate(-9),
  },
  // Ekub Admin notification (Selamawit Tesfaye)
  {
    id: 'demo-notif-sms-3day',
    userId: 'demo-admin-merkato',
    title: 'SMS: 3-Day Contribution Reminder',
    message: '[YegnaEkub SMS] Automated 3-day reminder dispatched to 5 members in "Merkato Weekly Circle" for Cycle #2.',
    type: 'contribution_reminder',
    read: false,
    channel: 'sms',
    recipientPhone: '+251 91 100 0001',
    smsDelivered: true,
    smsSentAt: nextDate(-1),
    daysBeforeDue: 3,
    createdAt: nextDate(-1),
    metadata: {
      ekubName: 'Merkato Weekly Circle',
      cycleNumber: 2,
      amount: 2000,
      dueDate: nextDate(2),
      carrier: 'Ethio Telecom SMS Gateway',
      amharicMessage: '[የኛ ዕቁብ SMS] ማሳሰቢያ፡ የ"Merkato Weekly Circle" ዕቁብ (ዙር #2) መዋጮ 2,000 ብር የመክፈያ ቀን በ3 ቀናት ውስጥ ነው። እባክዎ በቴሌብር ወይም በCBE ይክፈሉ።',
    },
  },
  {
    id: 'demo-notif-sms-overdue',
    userId: 'demo-admin-merkato',
    title: 'SMS: OVERDUE Contribution Alert',
    message: '[YegnaEkub SMS] URGENT: 4 members in "Merkato Weekly Circle" have unpaid contributions past the due date. Marked in RED on the Admin Dashboard.',
    type: 'overdue_alert',
    read: false,
    channel: 'both',
    recipientPhone: '+251 91 100 0001',
    smsDelivered: true,
    smsSentAt: nextDate(-1),
    daysBeforeDue: -2,
    createdAt: nextDate(-1),
    metadata: {
      ekubName: 'Merkato Weekly Circle',
      cycleNumber: 2,
      amount: 2000,
      dueDate: nextDate(-2),
      carrier: 'Ethio Telecom SMS Gateway',
    },
  },
  {
    id: 'demo-notif-1',
    userId: 'demo-admin-merkato',
    title: 'Draw Completed',
    message: 'Meron Assefa won Cycle #1 of Merkato Weekly Circle -- 40,000 ETB.',
    type: 'draw_completed',
    read: false,
    createdAt: nextDate(-7),
  },
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
