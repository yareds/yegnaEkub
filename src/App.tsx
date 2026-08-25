import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './firebase/AuthContext';
import { TranslationProvider, useTranslation } from './locales/TranslationContext';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
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
import { JoinEkubModal } from './components/JoinEkubModal';
import { LegalModal } from './components/LegalModal';
import { NotificationsModal } from './components/NotificationsModal';
import {
  getEkubs,
  getContributions,
  getDraws,
  getPayouts,
  getNotifications,
  getSupportTickets,
  markNotificationsAsRead
} from './firebase/ekubService';
import { SignInModal } from './components/SignInModal';
import { YegnaEkubLogo } from './components/YegnaEkubLogo';
import { Ekub, Contribution, Draw, Payout, AppNotification, SupportTicket } from './types';

function MainAppContent() {
  const { userProfile, isSuperAdmin, isAdmin, user, loading: authLoading } = useAuth();
  const { t, language } = useTranslation();

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedEkub, setSelectedEkub] = useState<Ekub | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  // Domain Datasets
  const [ekubs, setEkubs] = useState<Ekub[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Role verification: is the user a Super Admin or the designated admin of at least one Ekub?
  const isEkubAdminOfAny = Boolean(userProfile?.uid && ekubs.some(e => e.adminId === userProfile.uid));
  const hasAdminAccess = isSuperAdmin || isEkubAdminOfAny;

  // Modals
  const [contributeEkub, setContributeEkub] = useState<Ekub | null>(null);
  const [liveDrawEkub, setLiveDrawEkub] = useState<Ekub | null>(null);
  const [verifyDrawTarget, setVerifyDrawTarget] = useState<Draw | null>(null);
  const [payoutClaimTarget, setPayoutClaimTarget] = useState<Payout | null>(null);
  const [showCreateEkub, setShowCreateEkub] = useState(false);
  const [showJoinEkub, setShowJoinEkub] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Redirect guard: if on admin tab but lack authorization, redirect to dashboard
  useEffect(() => {
    if (!dataLoading && activeTab === 'admin' && !hasAdminAccess) {
      setActiveTab('dashboard');
    }
  }, [activeTab, dataLoading, hasAdminAccess]);

  const refreshAllData = async () => {
    try {
      const isSuperAdminUser = userProfile?.role === 'super_admin' || (userProfile?.role as string) === 'admin';

      // Ekub list is needed up front to know which circles (if any) this
      // user administers, since contribution/payout scope depends on that.
      const eList = await getEkubs();
      setEkubs(Array.isArray(eList) ? eList : []);

      const adminEkubIds = Array.isArray(eList)
        ? eList.filter(e => e.adminId === userProfile?.uid).map(e => e.id)
        : [];

      const [dList, nList, tList] = await Promise.all([
        getDraws(),
        getNotifications(userProfile?.uid),
        getSupportTickets(isSuperAdminUser ? undefined : userProfile?.uid),
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
          getContributions(undefined, userProfile?.uid),
          getPayouts(undefined, userProfile?.uid),
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
    if (user) {
      refreshAllData();
    } else {
      setDataLoading(false);
    }
  }, [userProfile?.uid, user]);

  const handleNavigate = (tab: string) => {
    setSelectedEkub(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectEkub = (ekub: Ekub) => {
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
          />
        </main>

        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
        {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FC] text-gray-900 flex flex-col font-sans selection:bg-[#7856FF]/20 selection:text-[#7856FF]">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={selectedEkub ? 'ekub-detail' : activeTab}
        onNavigate={handleNavigate}
        notifications={notifications || []}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenCreateEkub={() => setShowCreateEkub(true)}
        onOpenJoinEkub={() => setShowJoinEkub(true)}
        onOpenLegal={() => setShowLegal(true)}
        unreadCount={(notifications || []).filter(n => !n.read).length}
        hasAdminAccess={hasAdminAccess}
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
            draws={draws}
            onBack={() => setSelectedEkub(null)}
            onOpenContribute={(e) => setContributeEkub(e)}
            onOpenLiveDraw={(e) => setLiveDrawEkub(e)}
            onOpenVerifyDraw={(d) => setVerifyDrawTarget(d)}
          />
        ) : (
          <>
            {activeTab === 'landing' && (
              <LandingPage
                onStartEkub={() => setShowCreateEkub(true)}
                onJoinEkub={() => setShowJoinEkub(true)}
                onExploreEkubs={() => handleNavigate('discover')}
                onOpenLegal={() => setShowLegal(true)}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard
                ekubs={ekubs}
                contributions={contributions}
                draws={draws}
                payouts={payouts}
                onSelectEkub={handleSelectEkub}
                onOpenContribute={(e) => setContributeEkub(e || ekubs[0])}
                onOpenLiveDraw={(e) => setLiveDrawEkub(e || ekubs[0])}
                onOpenVerifyDraw={(d) => setVerifyDrawTarget(d || draws[0])}
                onOpenPayout={(p) => setPayoutClaimTarget(p || payouts[0])}
                onOpenCreateEkub={() => setShowCreateEkub(true)}
                onOpenJoinEkub={() => setShowJoinEkub(true)}
                onNavigateTab={handleNavigate}
              />
            )}

            {activeTab === 'discover' && (
              <DiscoverView
                ekubs={ekubs}
                onSelectEkub={handleSelectEkub}
                onOpenCreate={() => setShowCreateEkub(true)}
                onOpenJoin={() => setShowJoinEkub(true)}
              />
            )}

            {activeTab === 'contributions' && (
              <ContributionsView
                contributions={contributions}
                ekubs={ekubs}
                onOpenContribute={(e) => setContributeEkub(e || ekubs[0])}
              />
            )}

            {activeTab === 'draws' && (
              <DrawsView
                draws={draws}
                ekubs={ekubs}
                onOpenLiveDraw={(e) => setLiveDrawEkub(e || ekubs[0])}
                onOpenVerifyDraw={(d) => setVerifyDrawTarget(d)}
              />
            )}

            {activeTab === 'payouts' && (
              <PayoutsView
                payouts={payouts}
                onOpenClaim={(p) => setPayoutClaimTarget(p)}
              />
            )}

            {activeTab === 'admin' && hasAdminAccess && (
              <AdminDashboard
                ekubs={ekubs}
                contributions={contributions}
                draws={draws}
                payouts={payouts}
                supportTickets={tickets}
                onRefreshData={refreshAllData}
                onOpenLiveDraw={(e) => setLiveDrawEkub(e)}
                onOpenVerifyDraw={(d) => setVerifyDrawTarget(d)}
                onOpenCreateEkub={() => setShowCreateEkub(true)}
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
      />

      {/* MODALS */}
      {contributeEkub && (
        <ContributeModal
          ekub={contributeEkub}
          onClose={() => setContributeEkub(null)}
          onSuccess={refreshAllData}
        />
      )}

      {liveDrawEkub && (
        <LiveDrawModal
          ekub={liveDrawEkub}
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
          onClose={() => setShowCreateEkub(false)}
          onSuccess={(newEkub) => {
            refreshAllData();
            handleSelectEkub(newEkub);
          }}
        />
      )}

      {showJoinEkub && (
        <JoinEkubModal
          onClose={() => setShowJoinEkub(false)}
          onSuccess={(joinedEkub) => {
            refreshAllData();
            handleSelectEkub(joinedEkub);
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
