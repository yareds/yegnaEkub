import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './firebase/AuthContext';
import { TranslationProvider, useTranslation } from './locales/TranslationContext';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { EkubDetail } from './components/EkubDetail';
import { DiscoverView } from './components/DiscoverView';
import { ContributionsView } from './components/ContributionsView';
import { DrawsView } from './components/DrawsView';
import { PayoutsView } from './components/PayoutsView';
import { AdminDashboard } from './components/AdminDashboard';
import { DisputeCenter } from './components/DisputeCenter';
import { ContributeModal } from './components/ContributeModal';
import { LiveDrawModal } from './components/LiveDrawModal';
import { VerifyDrawModal } from './components/VerifyDrawModal';
import { PayoutWorkflowModal } from './components/PayoutWorkflowModal';
import { CreateEkubModal } from './components/CreateEkubModal';
import { LegalModal } from './components/LegalModal';
import { NotificationsModal } from './components/NotificationsModal';
import {
  getEkubs,
  getContributions,
  getDraws,
  getPayouts,
  getNotifications,
  getSupportTickets,
  markNotificationsAsRead,
  getMyMemberEkubIds
} from './firebase/ekubService';
import { SignInModal } from './components/SignInModal';
import { YegnaEkubLogo } from './components/YegnaEkubLogo';
import { Ekub, Contribution, Draw, Payout, AppNotification, SupportTicket, UserProfile } from './types';
import { setDemoModeActive } from './firebase/ekubService';
import { DEMO_EKUBS, DEMO_MEMBERS, DEMO_CONTRIBUTIONS, DEMO_DRAWS, DEMO_PAYOUTS, DEMO_NOTIFICATIONS } from './data/demoData';

// Demo Mode identities -- these UIDs are deliberately the same ones already
// Role-specific demo profiles for the zero-config offline demonstration.
// UIDs are aligned with the sample datasets in data/demoData.ts.
// Rahel Getachew can belong to TWO different Ekub circles (Merkato and Piazza),
// but under separate, strictly isolated logins as required!
export type DemoRoleId = 
  | 'super_admin' 
  | 'ekub_admin' 
  | 'ekub_admin_merkato' 
  | 'ekub_admin_piazza' 
  | 'member' 
  | 'member_merkato' 
  | 'member_piazza';

const DEMO_PROFILES: Record<string, UserProfile> = {
  super_admin: {
    uid: 'demo-super-admin', fullName: 'Demo Super Admin', email: 'super-admin@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0000', photoURL: '', role: 'super_admin', preferredLanguage: 'en',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  ekub_admin: {
    uid: 'demo-admin-merkato', fullName: 'Selamawit Tesfaye', email: 'admin.merkato.weekly@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0001', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-merkato-weekly', ekubName: 'Merkato Weekly Circle',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  ekub_admin_merkato: {
    uid: 'demo-admin-merkato', fullName: 'Selamawit Tesfaye', email: 'admin.merkato.weekly@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0001', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-merkato-weekly', ekubName: 'Merkato Weekly Circle',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  ekub_admin_piazza: {
    uid: 'demo-admin-piazza', fullName: 'Dawit Alemu', email: 'admin.piazza.monthly@yegnaekub-demo.et',
    phoneNumber: '+251 91 100 0005', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-piazza-monthly', ekubName: 'Piazza Monthly Cooperative',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  member: {
    uid: 'demo-rahel-merkato', fullName: 'Rahel Getachew', email: 'rahel.merkato@example.et',
    phoneNumber: '+251 91 100 0002', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-merkato-weekly', ekubName: 'Merkato Weekly Circle',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  member_merkato: {
    uid: 'demo-rahel-merkato', fullName: 'Rahel Getachew', email: 'rahel.merkato@example.et',
    phoneNumber: '+251 91 100 0002', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-merkato-weekly', ekubName: 'Merkato Weekly Circle',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
  member_piazza: {
    uid: 'demo-rahel-piazza', fullName: 'Rahel Getachew', email: 'rahel.piazza@example.et',
    phoneNumber: '+251 91 100 0002', photoURL: '', role: 'member', preferredLanguage: 'en',
    ekubId: 'demo-ekub-piazza-monthly', ekubName: 'Piazza Monthly Cooperative',
    verificationStatus: 'verified', createdAt: new Date().toISOString(),
  } as UserProfile,
};

function MainAppContent() {
  const { userProfile: realUserProfile, isSuperAdmin: realIsSuperAdmin, isAdmin: realIsAdmin, user: realUser, loading: authLoading } = useAuth();
  const { t, language } = useTranslation();

  // Demo Mode -- explored from the landing page, no real sign-in involved.
  // Persisted to localStorage per the requirement that this never touches
  // Firebase: everything about the experience, including which role is
  // being viewed, lives entirely on the visitor's own device.
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    try { return localStorage.getItem('yegnaekub_demo_mode') === 'true'; } catch { return false; }
  });
  const [demoRole, setDemoRole] = useState<string>(() => {
    try { return (localStorage.getItem('yegnaekub_demo_role') as string) || 'member_merkato'; } catch { return 'member_merkato'; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('yegnaekub_demo_mode', String(demoMode));
      localStorage.setItem('yegnaekub_demo_role', demoRole);
    } catch { /* localStorage unavailable -- demo still works for this session */ }
    // Keep the ekubService.ts write-guard in sync -- second layer of
    // protection against ever writing real data while in Demo Mode.
    setDemoModeActive(demoMode);
  }, [demoMode, demoRole]);

  // Shadow the real auth values with demo-aware ones, using the SAME
  // variable names -- every downstream computation in this file (isEkubAdminOfAny,
  // myEkubs, hasAdminAccess, etc.) already derives from these, so overriding
  // them here is enough to make the entire rest of the component tree work
  // correctly in Demo Mode without touching any of it individually.
  const userProfile = demoMode ? (DEMO_PROFILES[demoRole] || DEMO_PROFILES.member_merkato) : realUserProfile;
  const isSuperAdmin = demoMode ? demoRole === 'super_admin' : realIsSuperAdmin;
  const isAdmin = demoMode ? demoRole === 'super_admin' : realIsAdmin;
  const user = demoMode ? ({ uid: userProfile.uid, email: userProfile.email } as any) : realUser;

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedEkub, setSelectedEkub] = useState<Ekub | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  // Domain Datasets
  const [ekubs, setEkubs] = useState<Ekub[]>([]);
  const [myMemberEkubIds, setMyMemberEkubIds] = useState<string[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Role verification: is the user a Super Admin or the designated admin of at least one Ekub?
  const isEkubAdminOfAny = Boolean(userProfile?.uid && ekubs.some(e => e.adminId === userProfile.uid));

  // Strict Per-Ekub Isolation:
  // When logged into a specific Ekub account, the user sees ONLY everything
  // related to that specific Ekub circle, including draws, contributions, and live draws.
  const myEkubs = isSuperAdmin
    ? ekubs
    : ekubs.filter(e => {
        if (userProfile?.ekubId) {
          return e.id === userProfile.ekubId;
        }
        return e.adminId === userProfile?.uid || myMemberEkubIds.includes(e.id);
      });
  const hasAdminAccess = isSuperAdmin || isEkubAdminOfAny;

  // Scoped datasets: ensure non-super-admin users only ever receive records for their own circle
  const myEkubIds = myEkubs.map(e => e.id);
  const scopedContributions = isSuperAdmin
    ? contributions
    : contributions.filter(c => myEkubIds.includes(c.ekubId));
  const scopedDraws = isSuperAdmin
    ? draws
    : draws.filter(d => myEkubIds.includes(d.ekubId));
  const scopedPayouts = isSuperAdmin
    ? payouts
    : payouts.filter(p => myEkubIds.includes(p.ekubId));

  // Modals
  const [contributeEkub, setContributeEkub] = useState<Ekub | null>(null);
  const [liveDrawEkub, setLiveDrawEkub] = useState<Ekub | null>(null);
  const [verifyDrawTarget, setVerifyDrawTarget] = useState<Draw | null>(null);
  const [payoutClaimTarget, setPayoutClaimTarget] = useState<Payout | null>(null);
  const [showCreateEkub, setShowCreateEkub] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Redirect guard: if on admin tab but lack authorization, redirect to dashboard
  useEffect(() => {
    if (!dataLoading && activeTab === 'admin' && !hasAdminAccess) {
      setActiveTab('dashboard');
    }
  }, [activeTab, dataLoading, hasAdminAccess]);

  // The Super Admin is never a member of any Ekub -- they have no
  // personal contributions/draws to participate in. Their primary workspaces
  // are the Super Admin Overview (dashboard) and Governance Center (admin).
  // Redirect them if they navigate to member-only views.
  useEffect(() => {
    if (!dataLoading && isSuperAdmin && ['discover', 'contributions', 'draws', 'payouts'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, dataLoading, isSuperAdmin]);

  const refreshAllData = async () => {
    try {
      const currentUid = userProfile?.uid || user?.uid;
      const isSuperAdminUser = isSuperAdmin || userProfile?.role === 'super_admin' || 
        ((user?.email || userProfile?.email || '').toLowerCase().trim() === 'yared.abegaz@gmail.com');

      // Ekub list is needed up front to know which circles (if any) this
      // user administers, since contribution/payout scope depends on that.
      const eList = await getEkubs();
      setEkubs(Array.isArray(eList) ? eList : []);

      const adminEkubIds = Array.isArray(eList) && currentUid
        ? eList.filter(e => e.adminId === currentUid).map(e => e.id)
        : [];

      // Which circles is this user an ACTIVE MEMBER of (as opposed to
      // administering)? Needed so member-facing views (Dashboard, Draws,
      // Contributions, Payouts) only ever show circles this specific user
      // actually belongs to, not every circle on the platform. Super Admin
      // skips this entirely -- they see everything regardless.
      const isSuperAdminUserForScope = isSuperAdminUser;
      const memberEkubIds = (!isSuperAdminUserForScope && Array.isArray(eList) && currentUid)
        ? await getMyMemberEkubIds(eList.map(e => e.id), currentUid)
        : [];
      setMyMemberEkubIds(memberEkubIds);

      const [dList, nList, tList] = await Promise.all([
        getDraws(),
        getNotifications(currentUid),
        getSupportTickets(isSuperAdminUser ? undefined : currentUid),
      ]);
      setDraws(Array.isArray(dList) ? dList : []);
      setNotifications(Array.isArray(nList) ? nList : []);
      setTickets(Array.isArray(tList) ? tList : []);

      if (isSuperAdminUser) {
        // Super Admin: unfiltered, platform-wide.
        const [cList, pList] = await Promise.all([getContributions(), getPayouts()]);
        setContributions(Array.isArray(cList) ? cList : []);
        setPayouts(Array.isArray(pList) ? pList : []);
      } else {
        // Everyone else: their own contributions/payouts as a member
        // (across any Ekub they belong to), PLUS -- if they administer one
        // or more Ekubs -- the FULL, unfiltered contributions/payouts for
        // those specific circles, since an Ekub Admin needs to see and
        // verify every member's submissions, not just their own.
        const [ownContribs, ownPayouts, adminContribArrays, adminPayoutArrays] = await Promise.all([
          getContributions(undefined, currentUid),
          getPayouts(undefined, currentUid),
          Promise.all(adminEkubIds.map(id => getContributions(id))),
          Promise.all(adminEkubIds.map(id => getPayouts(id))),
        ]);

        const contribMap = new Map<string, Contribution>();
        [...(ownContribs || []), ...adminContribArrays.flat()].forEach(c => contribMap.set(c.id, c));
        setContributions(Array.from(contribMap.values()));

        const payoutMap = new Map<string, Payout>();
        [...(ownPayouts || []), ...adminPayoutArrays.flat()].forEach(p => payoutMap.set(p.id, p));
        setPayouts(Array.from(payoutMap.values()));
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (demoMode) {
      return; // populated by the Demo Mode effect below instead
    }
    if (user) {
      refreshAllData();
    } else {
      setDataLoading(false);
    }
  }, [userProfile?.uid, user, demoMode]);

  // Demo Mode data -- pulled entirely from static sample data, never from
  // Firebase, matching the requirement that nothing in this experience is
  // ever saved or read from the real backend.
  useEffect(() => {
    if (!demoMode) return;
    setEkubs(DEMO_EKUBS);
    setContributions(DEMO_CONTRIBUTIONS);
    setDraws(DEMO_DRAWS);
    setPayouts(DEMO_PAYOUTS);
    const profile = DEMO_PROFILES[demoRole] || DEMO_PROFILES.member_merkato;
    const uid = profile.uid;
    setNotifications(DEMO_NOTIFICATIONS.filter(n => n.userId === uid));
    setTickets([]);
    const memberOfEkubIds = profile.ekubId
      ? [profile.ekubId]
      : Object.entries(DEMO_MEMBERS)
          .filter(([, members]) => members.some(m => m.userId === uid))
          .map(([ekubId]) => ekubId);
    setMyMemberEkubIds(memberOfEkubIds);
    setDataLoading(false);
  }, [demoMode, demoRole]);

  const handleNavigate = (tab: string) => {
    setSelectedEkub(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectEkub = (ekub: Ekub) => {
    // Non-super-admins cannot view details of circles they do not belong to
    if (!isSuperAdmin && !myEkubs.some(e => e.id === ekub.id)) {
      return;
    }
    setSelectedEkub(ekub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkNotificationsRead = async () => {
    await markNotificationsAsRead(userProfile?.uid);
    setNotifications(prev => (prev || []).map(n => ({ ...n, read: true })));
  };

  // Auth gate: while Firebase Auth is still determining session state, show
  // a plain spinner rather than any app content (signed in or not).
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7FC] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#7856FF] border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  // Auth gate: nobody is signed in. Show the public landing page and a
  // lightweight header with a real Sign In entry point -- never the
  // authenticated dashboard, and never a fabricated "signed in" display.
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F7FC] text-gray-900 flex flex-col font-sans">
        <header className="sticky top-0 z-40 h-16 bg-[#1C1132] text-white border-b-2 border-[#7856FF]/30 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
            <YegnaEkubLogo
              variant="full"
              size="sm"
              theme="dark"
              showSubtext={true}
              subtextText={language === 'am' ? 'ዲጂታል ዕቁብ' : 'DIGITAL ROSCA'}
            />
            <button
              onClick={() => setShowSignIn(true)}
              className="px-4 py-2 bg-[#7856FF] hover:bg-[#6340FF] text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
            >
              {t.signIn}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
          <LandingPage
            onStartEkub={() => setShowSignIn(true)}
            onJoinEkub={() => setShowSignIn(true)}
            onExploreEkubs={() => setShowSignIn(true)}
            onOpenLegal={() => setShowLegal(true)}
            onStartDemo={(role) => { setDemoRole(role); setDemoMode(true); }}
          />
        </main>

        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
        {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FC] text-gray-900 flex flex-col font-sans selection:bg-[#7856FF]/20 selection:text-[#7856FF]">

      {demoMode && (
        <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-xs font-bold px-4 py-2 flex flex-wrap items-center justify-center gap-3">
          <span>
            {language === 'am'
              ? 'የናሙና ውሂብ የያዘ ማሳያ ሁነታ ውስጥ ነዎት -- ምንም ነገር አይቀመጥም።'
              : "You're exploring a live demo with sample data -- nothing here is ever saved."}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="uppercase tracking-wider opacity-70">{language === 'am' ? 'የመግቢያ መለያ' : 'Active Account'}:</span>
            <select
              value={demoRole}
              onChange={(e) => {
                setDemoRole(e.target.value);
                setSelectedEkub(null);
              }}
              className="px-2.5 py-1 rounded-md border border-amber-600 bg-white text-amber-950 text-xs font-bold shadow-xs cursor-pointer"
            >
              <optgroup label="Rahel Getachew (Two Ekubs • Separate Scoped Logins)">
                <option value="member_merkato">Rahel Getachew — Merkato Circle Account</option>
                <option value="member_piazza">Rahel Getachew — Piazza Circle Account</option>
              </optgroup>
              <optgroup label="Ekub Admins (Managed Circles)">
                <option value="ekub_admin_merkato">Selamawit Tesfaye — Merkato Admin</option>
                <option value="ekub_admin_piazza">Dawit Alemu — Piazza Admin</option>
              </optgroup>
              <optgroup label="Platform Governance">
                <option value="super_admin">Super Admin (Platform Oversight)</option>
              </optgroup>
            </select>
          </span>
          <button
            onClick={() => {
              try {
                localStorage.setItem('yegnaekub_demo_mode', 'false');
              } catch { /* ignore */ }
              window.location.reload();
            }}
            className="px-3 py-1 bg-amber-950 text-white rounded-md uppercase tracking-wider hover:bg-black transition-colors"
          >
            {language === 'am' ? 'ማሳያውን ውጣ' : 'Exit Demo'}
          </button>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={selectedEkub ? 'ekub-detail' : activeTab}
        onNavigate={handleNavigate}
        notifications={notifications || []}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenCreateEkub={() => setShowCreateEkub(true)}
        onOpenLegal={() => setShowLegal(true)}
        unreadCount={(notifications || []).filter(n => !n.read).length}
        hasAdminAccess={hasAdminAccess}
        isEkubAdminOfAny={isEkubAdminOfAny}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        userProfile={userProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-12">
        {dataLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-3 border-[#7856FF] border-t-transparent animate-spin rounded-full" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7856FF]">
              {t.loading}
            </p>
          </div>
        ) : selectedEkub ? (
          <EkubDetail
            ekub={selectedEkub}
            draws={scopedDraws}
            userProfile={userProfile}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            onBack={() => setSelectedEkub(null)}
            onOpenContribute={(e) => setContributeEkub(e || selectedEkub)}
            onOpenLiveDraw={(e) => setLiveDrawEkub(e || selectedEkub)}
            onOpenVerifyDraw={(d) => setVerifyDrawTarget(d)}
          />
        ) : (
          <>
            {activeTab === 'landing' && (
              <LandingPage
                onStartEkub={() => setShowCreateEkub(true)}
                onExploreEkubs={() => handleNavigate('discover')}
                onOpenLegal={() => setShowLegal(true)}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'dashboard' && (
              isSuperAdmin ? (
                <SuperAdminDashboard
                  key={userProfile?.uid}
                  ekubs={ekubs}
                  userProfile={userProfile}
                  onSelectEkub={handleSelectEkub}
                  onOpenCreateEkub={() => setShowCreateEkub(true)}
                  onNavigateTab={handleNavigate}
                  onRefreshData={refreshAllData}
                />
              ) : (
                <Dashboard
                  key={userProfile?.uid}
                  ekubs={myEkubs}
                  contributions={scopedContributions}
                  draws={scopedDraws}
                  payouts={scopedPayouts}
                  userProfile={userProfile}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                  onSelectEkub={handleSelectEkub}
                  onOpenContribute={(e) => setContributeEkub(e || myEkubs[0])}
                  onOpenLiveDraw={(e) => setLiveDrawEkub(e || myEkubs[0])}
                  onOpenVerifyDraw={(d) => setVerifyDrawTarget(d || scopedDraws[0])}
                  onOpenPayout={(p) => setPayoutClaimTarget(p || scopedPayouts[0])}
                  onOpenCreateEkub={() => setShowCreateEkub(true)}
                  onNavigateTab={handleNavigate}
                />
              )
            )}

            {activeTab === 'discover' && (
              <DiscoverView
                ekubs={ekubs}
                onSelectEkub={handleSelectEkub}
                onOpenCreate={() => setShowCreateEkub(true)}
              />
            )}

            {activeTab === 'contributions' && (
              <ContributionsView
                contributions={scopedContributions}
                ekubs={myEkubs}
                userProfile={userProfile}
                onOpenContribute={(e) => setContributeEkub(e || myEkubs[0])}
              />
            )}

            {activeTab === 'draws' && (
              <DrawsView
                draws={scopedDraws}
                ekubs={myEkubs}
                userProfile={userProfile}
                onOpenLiveDraw={(e) => setLiveDrawEkub(e || myEkubs[0])}
                onOpenVerifyDraw={(d) => setVerifyDrawTarget(d || scopedDraws[0])}
              />
            )}

            {activeTab === 'payouts' && (
              <PayoutsView
                payouts={scopedPayouts}
                userProfile={userProfile}
                onOpenClaim={(p) => setPayoutClaimTarget(p)}
              />
            )}

            {activeTab === 'admin' && hasAdminAccess && (
              <AdminDashboard
                key={userProfile?.uid}
                ekubs={ekubs}
                contributions={contributions}
                draws={draws}
                payouts={payouts}
                supportTickets={tickets}
                onRefreshData={refreshAllData}
                onOpenLiveDraw={(e) => setLiveDrawEkub(e)}
                onOpenVerifyDraw={(d) => setVerifyDrawTarget(d)}
                onOpenCreateEkub={() => setShowCreateEkub(true)}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
                userProfile={userProfile}
              />
            )}

            {activeTab === 'disputes' && (
              <DisputeCenter
                ekubs={ekubs}
                tickets={tickets}
                onRefreshTickets={refreshAllData}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={selectedEkub ? 'ekub-detail' : activeTab}
        onNavigate={handleNavigate}
        unreadCount={(notifications || []).filter(n => !n.read).length}
        hasAdminAccess={hasAdminAccess}
        isSuperAdmin={isSuperAdmin}
      />

      {/* MODALS */}
      {contributeEkub && (
        <ContributeModal
          ekub={contributeEkub}
          userProfile={userProfile}
          isDemoMode={demoMode}
          onClose={() => setContributeEkub(null)}
          onSuccess={refreshAllData}
        />
      )}

      {liveDrawEkub && (
        <LiveDrawModal
          ekub={liveDrawEkub}
          userProfile={userProfile}
          isDemoMode={demoMode}
          onClose={() => setLiveDrawEkub(null)}
          onSuccess={(newDraw) => {
            refreshAllData();
          }}
          onOpenVerify={(d) => {
            setLiveDrawEkub(null);
            setVerifyDrawTarget(d);
          }}
        />
      )}

      {verifyDrawTarget && (
        <VerifyDrawModal
          draw={verifyDrawTarget}
          onClose={() => setVerifyDrawTarget(null)}
        />
      )}

      {payoutClaimTarget && (
        <PayoutWorkflowModal
          payout={payoutClaimTarget}
          onClose={() => setPayoutClaimTarget(null)}
          onSuccess={refreshAllData}
        />
      )}

      {showCreateEkub && (
        <CreateEkubModal
          ekubs={ekubs}
          onClose={() => setShowCreateEkub(false)}
          onSuccess={(newEkub) => {
            refreshAllData();
            handleSelectEkub(newEkub);
          }}
        />
      )}

      {showLegal && (
        <LegalModal onClose={() => setShowLegal(false)} />
      )}

      {showNotifications && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkAllRead={handleMarkNotificationsRead}
        />
      )}

    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <TranslationProvider>
        <MainAppContent />
      </TranslationProvider>
    </AuthProvider>
  );
}

export default App;
