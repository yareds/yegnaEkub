export type UserRole = 'member' | 'organizer' | 'admin';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export type PreferredPaymentMethod = 'telebirr' | 'cbe' | 'cbe_birr' | 'dashen' | 'abyssinia';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  role: UserRole;
  preferredLanguage: 'en' | 'am';
  preferredPaymentMethod?: PreferredPaymentMethod;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt?: string;
}

export type EkubStatus = 'draft' | 'recruiting' | 'active' | 'drawing' | 'payout' | 'completed' | 'cancelled';
export type EkubFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Ekub {
  id: string;
  name: string;
  description: string;
  organizerId: string;
  organizerName: string;
  status: EkubStatus;
  contributionAmount: number;
  currency: 'ETB';
  frequency: EkubFrequency;
  memberLimit: number;
  currentMemberCount: number;
  startDate: string;
  nextContributionDate: string;
  nextDrawDate: string;
  payoutAmount: number;
  currentCycle: number;
  totalCycles: number;
  isPrivate: boolean;
  inviteCode?: string;
  rules?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EkubMember {
  userId: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  role: 'member' | 'organizer';
  status: 'active' | 'pending' | 'suspended';
  joinedAt: string;
  contributionStatus: 'paid' | 'pending' | 'overdue';
  eligibleForDraw: boolean;
  hasReceivedPayout: boolean;
  payoutCycle?: number;
  totalContributed: number;
  lastContributionDate?: string;
  cyclePosition?: number;
  updatedAt?: string;
}

export interface EkubCycle {
  id: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  contributionAmount: number;
  potAmount: number;
  status: 'open' | 'locked' | 'drawn' | 'completed';
  eligibleMemberCount: number;
  drawId?: string;
  winnerId?: string;
  winnerName?: string;
  payoutId?: string;
  createdAt: string;
  completedAt?: string;
}

export type ContributionStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'flagged';

export interface Contribution {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  ekubId: string;
  ekubName: string;
  cycleId: string;
  cycleNumber: number;
  amount: number;
  currency: 'ETB';
  paymentMethod: PreferredPaymentMethod;
  receiptUrl: string;
  transactionReference: string;
  status: ContributionStatus;
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  ekubId: string;
  ekubName: string;
  amount: number;
  currency: 'ETB';
  paymentMethod: PreferredPaymentMethod;
  transactionReference: string;
  receiptUrl: string;
  allocatedCycles: number[]; // e.g. [1, 2] for 2 cycles
  status: ContributionStatus;
  submittedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DrawStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';

export interface Draw {
  id: string;
  ekubId: string;
  ekubName: string;
  cycleId: string;
  cycleNumber: number;
  drawNumber: number;
  status: DrawStatus;
  scheduledAt: string;
  executedAt?: string;
  eligibleMemberIds: string[];
  eligibleMembersSnapshot?: {
    userId: string;
    displayName: string;
    photoURL?: string;
  }[];
  eligibleMemberCount: number;
  winnerId?: string;
  winnerName?: string;
  winnerPhotoURL?: string;
  payoutAmount: number;
  randomnessMethod: string;
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
  verificationHash?: string;
  verificationProof?: {
    combinedEntropy: string;
    hashResult: string;
    rawDecimal: string;
    winningIndex: number;
    explanation: string;
  };
  createdAt: string;
}

export type PayoutStatus = 
  | 'pending'
  | 'documents_required'
  | 'under_review'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'disputed';

export interface Payout {
  id: string;
  ekubId: string;
  ekubName: string;
  cycleId: string;
  cycleNumber: number;
  drawId: string;
  winnerId: string;
  winnerName: string;
  winnerEmail?: string;
  winnerPhone?: string;
  amount: number;
  currency: 'ETB';
  status: PayoutStatus;
  requiredDocuments: string[];
  submittedDocuments?: {
    name: string;
    url: string;
    submittedAt: string;
  }[];
  payoutAccountDetails?: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    phoneOrAmole?: string;
  };
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  processedAt?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NotificationType = 
  | 'ekub_invite'
  | 'membership_approval'
  | 'contribution_reminder'
  | 'payment_submitted'
  | 'payment_verified'
  | 'payment_rejected'
  | 'upcoming_draw'
  | 'draw_started'
  | 'draw_completed'
  | 'winner_announcement'
  | 'payout_approval'
  | 'payout_completed'
  | 'missed_contribution'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: 'payment' | 'draw' | 'payout' | 'ekub' | 'user' | 'rule' | 'system';
  entityId: string;
  previousState?: string | Record<string, unknown>;
  newState?: string | Record<string, unknown>;
  reason?: string;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface SupportTicket {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userEmail: string;
  ekubId?: string;
  ekubName?: string;
  category: 'payment' | 'eligibility' | 'draw' | 'payout' | 'account' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface SystemSettings {
  id: string;
  platformFeePercent: number;
  maintenanceMode: boolean;
  allowPublicEkubCreation: boolean;
  minWeeklyContribution: number;
  maxWeeklyContribution: number;
  supportedBanks: {
    code: PreferredPaymentMethod;
    name: string;
    accountNumber: string;
    accountName: string;
    instructions: string;
  }[];
}
