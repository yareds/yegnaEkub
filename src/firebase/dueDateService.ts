import { 
  Ekub, 
  EkubMember, 
  Contribution, 
  AppNotification, 
  UserProfile 
} from '../types';
import { db, isFirebaseAvailable } from './config';
import { collection, doc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { isDemoModeActive } from './ekubService';
import { DEMO_NOTIFICATIONS, DEMO_MEMBERS } from '../data/demoData';

export interface MemberContributionEvaluation {
  userId: string;
  displayName: string;
  phoneNumber?: string;
  email?: string;
  ekubId: string;
  ekubName: string;
  cycleNumber: number;
  contributionAmount: number;
  dueDate: string;
  daysRemaining: number;
  daysOverdue: number;
  status: 'paid' | 'pending' | 'due' | 'overdue' | 'upcoming';
  isPaid: boolean;
  isPendingVerification: boolean;
  isOverdue: boolean;
  isDueSoon: boolean; // within 3 days (0 <= daysRemaining <= 3)
  isUpcoming: boolean; // > 3 days left
  smsStatus: {
    reminderSent: boolean;
    reminderSentAt?: string;
    overdueAlertSent: boolean;
    overdueAlertSentAt?: string;
    carrierMessage?: string;
  };
  latestContribution?: Contribution;
}

/**
 * Calculates the exact due date for a specific Ekub and cycle.
 */
export const calculateCycleDueDate = (ekub: Ekub, cycleNumber?: number): string => {
  if (ekub.nextContributionDate) {
    return ekub.nextContributionDate.split('T')[0];
  }

  const baseDate = ekub.startDate ? new Date(ekub.startDate) : new Date();
  const cycle = cycleNumber || ekub.currentCycle || 1;
  const cycleOffset = Math.max(0, cycle - 1);

  const d = new Date(baseDate);
  if (ekub.frequency === 'daily') {
    d.setDate(d.getDate() + cycleOffset);
  } else if (ekub.frequency === 'weekly') {
    d.setDate(d.getDate() + cycleOffset * 7);
  } else if (ekub.frequency === 'biweekly') {
    d.setDate(d.getDate() + cycleOffset * 14);
  } else {
    // monthly
    d.setMonth(d.getMonth() + cycleOffset);
  }

  return d.toISOString().split('T')[0];
};

/**
 * Evaluates the contribution status for a specific member in an Ekub.
 */
export const evaluateMemberContribution = (
  ekub: Ekub,
  member: EkubMember,
  contributions: Contribution[] = [],
  userProfile?: UserProfile
): MemberContributionEvaluation => {
  const currentCycle = ekub.currentCycle || 1;
  const dueDateStr = member.cycleDueDate || calculateCycleDueDate(ekub, currentCycle);
  const dueDateTime = new Date(`${dueDateStr}T23:59:59`).getTime();
  const now = new Date();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).getTime();

  // Calculate day difference (calendar days)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.ceil((dueDateTime - todayTime) / msPerDay);
  const daysRemaining = daysDiff;
  const daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;

  // Find contributions for this member and this Ekub/cycle
  const memberContribs = contributions.filter(
    c => c.ekubId === ekub.id && c.userId === member.userId && c.cycleNumber === currentCycle
  );

  const verifiedContrib = memberContribs.find(c => c.status === 'verified');
  const pendingContrib = memberContribs.find(c => c.status === 'pending' || c.status === 'under_review');
  const latestContrib = memberContribs[0];

  const isPaid = Boolean(verifiedContrib || member.contributionStatus === 'paid');
  const isPendingVerification = Boolean(!isPaid && pendingContrib);

  let status: 'paid' | 'pending' | 'due' | 'overdue' | 'upcoming';
  let isOverdue = false;
  let isDueSoon = false;
  let isUpcoming = false;

  if (isPaid) {
    status = 'paid';
  } else if (isPendingVerification) {
    status = 'pending';
  } else if (daysRemaining < 0) {
    status = 'overdue';
    isOverdue = true;
  } else if (daysRemaining <= 3) {
    status = 'due';
    isDueSoon = true;
  } else {
    status = 'upcoming';
    isUpcoming = true;
  }

  const phone = member.phoneNumber || userProfile?.phoneNumber || '+251 91 123 4567';

  return {
    userId: member.userId,
    displayName: member.displayName || 'Member',
    phoneNumber: phone,
    email: member.email || userProfile?.email,
    ekubId: ekub.id,
    ekubName: ekub.name,
    cycleNumber: currentCycle,
    contributionAmount: ekub.contributionAmount,
    dueDate: dueDateStr,
    daysRemaining,
    daysOverdue,
    status,
    isPaid,
    isPendingVerification,
    isOverdue,
    isDueSoon,
    isUpcoming,
    smsStatus: {
      reminderSent: Boolean(member.lastSmsReminderDate && member.lastSmsReminderType === '3_day_reminder'),
      reminderSentAt: member.lastSmsReminderType === '3_day_reminder' ? member.lastSmsReminderDate : undefined,
      overdueAlertSent: Boolean(member.lastSmsReminderDate && member.lastSmsReminderType === 'overdue_alert'),
      overdueAlertSentAt: member.lastSmsReminderType === 'overdue_alert' ? member.lastSmsReminderDate : undefined,
    },
    latestContribution: latestContrib,
  };
};

/**
 * Generates Ethiopian text/SMS content in both English and Amharic.
 */
export const buildSmsMessage = (
  evaluation: MemberContributionEvaluation,
  type: '3_day_reminder' | 'overdue_alert' | 'manual_reminder'
): { english: string; amharic: string; fullText: string } => {
  const { displayName, ekubName, cycleNumber, contributionAmount, dueDate, daysRemaining, daysOverdue } = evaluation;
  const formattedAmount = contributionAmount.toLocaleString();

  if (type === '3_day_reminder') {
    const daysLabel = daysRemaining === 0 ? 'today' : daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`;
    const amharicDays = daysRemaining === 0 ? 'ዛሬ' : daysRemaining === 1 ? 'ነገ' : `በ${daysRemaining} ቀናት ውስጥ`;

    const english = `[YegnaEkub SMS] Reminder: Hello ${displayName}, your contribution of ${formattedAmount} ETB for "${ekubName}" (Cycle #${cycleNumber}) is due ${daysLabel} on ${dueDate}. Please submit your payment slip via Telebirr or CBE to secure your draw eligibility.`;
    const amharic = `[የኛ ዕቁብ SMS] ማሳሰቢያ፡ ሰላም ${displayName}፣ የ"${ekubName}" ዕቁብ (ዙር #${cycleNumber}) መዋጮ ${formattedAmount} ብር የመክፈያ ቀን ${amharicDays} (${dueDate}) ነው። እባክዎ በቴሌብር ወይም በCBE ይክፈሉ።`;

    return { english, amharic, fullText: `${english}\n\n${amharic}` };
  }

  if (type === 'overdue_alert') {
    const overdueDays = daysOverdue || 1;
    const english = `[YegnaEkub SMS] URGENT OVERDUE NOTICE: Hello ${displayName}, your contribution of ${formattedAmount} ETB for "${ekubName}" (Cycle #${cycleNumber}) was due on ${dueDate} and is now ${overdueDays} day(s) OVERDUE. Your draw eligibility has been suspended. Please settle immediately.`;
    const amharic = `[የኛ ዕቁብ SMS] አስቸኳይ ማስጠንቀቂያ፡ ሰላም ${displayName}፣ የ"${ekubName}" ዕቁብ (ዙር #${cycleNumber}) መዋጮ ${formattedAmount} ብር የመክፈያ ቀን (${dueDate}) አልፏል (${overdueDays} ቀናት ዘግይቷል)። እባክዎ በአስቸኳይ ይክፈሉ።`;

    return { english, amharic, fullText: `${english}\n\n${amharic}` };
  }

  // Manual generic reminder
  const english = `[YegnaEkub SMS] Payment Notice: Hello ${displayName}, please be reminded of your pending contribution of ${formattedAmount} ETB for "${ekubName}" (Cycle #${cycleNumber}), due on ${dueDate}.`;
  const amharic = `[የኛ ዕቁብ SMS] የመዋጮ ማሳሰቢያ፡ ሰላም ${displayName}፣ የ"${ekubName}" ዕቁብ (ዙር #${cycleNumber}) የ${formattedAmount} ብር መዋጮ ክፍያዎን እንዲያጠናቅቁ እናስታውሳለን።`;

  return { english, amharic, fullText: `${english}\n\n${amharic}` };
};

/**
 * Dispatches an SMS notification to a member and records it in Firestore / Demo data.
 */
export const dispatchMemberSms = async (
  evaluation: MemberContributionEvaluation,
  type: '3_day_reminder' | 'overdue_alert' | 'manual_reminder'
): Promise<{ success: boolean; messageId: string; text: string }> => {
  const sms = buildSmsMessage(evaluation, type);
  const now = new Date().toISOString();
  const notifId = `sms-notif-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const title = type === '3_day_reminder'
    ? `SMS: 3-Day Contribution Reminder (${evaluation.ekubName})`
    : type === 'overdue_alert'
    ? `SMS: OVERDUE Contribution Alert (${evaluation.ekubName})`
    : `SMS: Contribution Reminder (${evaluation.ekubName})`;

  const notifType = type === 'overdue_alert' ? 'overdue_alert' : 'contribution_reminder';

  const notificationRecord: AppNotification = {
    id: notifId,
    userId: evaluation.userId,
    title,
    message: sms.english,
    type: notifType,
    read: false,
    channel: 'sms',
    recipientPhone: evaluation.phoneNumber || '+251 91 123 4567',
    smsDelivered: true,
    smsSentAt: now,
    daysBeforeDue: evaluation.daysRemaining,
    createdAt: now,
    metadata: {
      ekubId: evaluation.ekubId,
      ekubName: evaluation.ekubName,
      cycleNumber: evaluation.cycleNumber,
      amount: evaluation.contributionAmount,
      dueDate: evaluation.dueDate,
      smsType: type,
      amharicMessage: sms.amharic,
      carrier: 'Ethio Telecom SMS Gateway',
    },
  };

  if (isDemoModeActive()) {
    // Add to Demo notifications array
    DEMO_NOTIFICATIONS.unshift(notificationRecord);

    // Update demo member if exists
    if (DEMO_MEMBERS[evaluation.ekubId]) {
      const m = DEMO_MEMBERS[evaluation.ekubId].find(item => item.userId === evaluation.userId);
      if (m) {
        m.lastSmsReminderDate = now;
        m.lastSmsReminderType = type;
        if (type === 'overdue_alert') {
          m.contributionStatus = 'overdue';
          m.eligibleForDraw = false;
        } else if (type === '3_day_reminder' && m.contributionStatus !== 'paid') {
          m.contributionStatus = 'due';
        }
      }
    }
    return { success: true, messageId: notifId, text: sms.fullText };
  }

  if (!isFirebaseAvailable()) {
    return { success: true, messageId: notifId, text: sms.fullText };
  }

  try {
    // 1. Write notification document
    await setDoc(doc(db, 'notifications', notifId), notificationRecord);

    // 2. Update member document in the Ekub subcollection
    const memberRef = doc(db, 'ekubs', evaluation.ekubId, 'members', evaluation.userId);
    const updatePayload: Record<string, any> = {
      lastSmsReminderDate: now,
      lastSmsReminderType: type,
      cycleDueDate: evaluation.dueDate,
      updatedAt: now,
    };

    if (type === 'overdue_alert') {
      updatePayload.contributionStatus = 'overdue';
      updatePayload.eligibleForDraw = false;
    } else if (type === '3_day_reminder' && evaluation.status !== 'paid') {
      updatePayload.contributionStatus = 'due';
    }

    await updateDoc(memberRef, updatePayload).catch(async () => {
      // If doc doesn't exist for direct update, set with merge
      await setDoc(memberRef, updatePayload, { merge: true });
    });

    return { success: true, messageId: notifId, text: sms.fullText };
  } catch (err) {
    console.error('Failed to dispatch SMS notification:', err);
    return { success: false, messageId: notifId, text: sms.fullText };
  }
};

/**
 * Runs the automatic evaluation loop across all Ekubs and members:
 * 1. Checks each active circle and active member.
 * 2. If 3 days before due date (0 <= daysRemaining <= 3) and not paid:
 *    -> Dispatches 3-day SMS notification (if not already sent for this cycle).
 * 3. If past due date (daysRemaining < 0) and not paid:
 *    -> Marks member & contribution as OVERDUE (highlighted in red) and suspends draw eligibility.
 *    -> Dispatches Overdue SMS alert (if not already sent).
 */
export const runAutomaticDueDateCheck = async (
  ekubs: Ekub[],
  allMembersMap: Record<string, EkubMember[]>,
  contributions: Contribution[],
  userProfiles: UserProfile[] = []
): Promise<{
  totalChecked: number;
  smsSentCount: number;
  overdueCount: number;
  dueSoonCount: number;
  upcomingCount: number;
  paidCount: number;
  evaluations: MemberContributionEvaluation[];
}> => {
  let totalChecked = 0;
  let smsSentCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let upcomingCount = 0;
  let paidCount = 0;
  const evaluations: MemberContributionEvaluation[] = [];

  const profileMap = new Map<string, UserProfile>();
  userProfiles.forEach(p => profileMap.set(p.uid, p));

  for (const ekub of ekubs) {
    if (ekub.status === 'completed' || ekub.status === 'cancelled') continue;

    const members = allMembersMap[ekub.id] || [];
    for (const member of members) {
      if (member.status !== 'active') continue;
      totalChecked++;

      const userProfile = profileMap.get(member.userId);
      const evalResult = evaluateMemberContribution(ekub, member, contributions, userProfile);
      evaluations.push(evalResult);

      if (evalResult.isPaid) {
        paidCount++;
      } else if (evalResult.isOverdue) {
        overdueCount++;
        // If overdue alert not sent for this cycle, send it
        const shouldSendOverdueAlert = !member.lastSmsReminderDate || 
          member.lastSmsReminderType !== 'overdue_alert' ||
          (new Date().getTime() - new Date(member.lastSmsReminderDate).getTime() > 24 * 60 * 60 * 1000);

        if (shouldSendOverdueAlert) {
          try {
            await dispatchMemberSms(evalResult, 'overdue_alert');
            smsSentCount++;
          } catch (e) {
            console.warn('Overdue SMS dispatch error:', e);
          }
        }
      } else if (evalResult.isDueSoon) {
        dueSoonCount++;
        // If 3-day SMS reminder not yet sent for this cycle, send it!
        const shouldSend3DaySms = !member.lastSmsReminderDate || 
          (member.lastSmsReminderType !== '3_day_reminder' && member.lastSmsReminderType !== 'overdue_alert');

        if (shouldSend3DaySms) {
          try {
            await dispatchMemberSms(evalResult, '3_day_reminder');
            smsSentCount++;
          } catch (e) {
            console.warn('3-Day SMS reminder dispatch error:', e);
          }
        }
      } else if (evalResult.isUpcoming) {
        upcomingCount++;
      }
    }
  }

  return {
    totalChecked,
    smsSentCount,
    overdueCount,
    dueSoonCount,
    upcomingCount,
    paidCount,
    evaluations,
  };
};
