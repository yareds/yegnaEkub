import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  Award, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Copy, 
  Check, 
  UserCheck 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../firebase/AuthContext';
import { useTranslation } from '../locales/TranslationContext';
import { Ekub, EkubMember, Draw } from '../types';
import { getEkubMembers, executeDraw } from '../firebase/ekubService';

interface LiveDrawModalProps {
  ekub: Ekub;
  onClose: () => void;
  onSuccess: (newDraw: Draw) => void;
  onOpenVerify: (draw: Draw) => void;
}

export const LiveDrawModal: React.FC<LiveDrawModalProps> = ({
  ekub,
  onClose,
  onSuccess,
  onOpenVerify,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const { t, language } = useTranslation();

  // isAdmin (from useAuth) reflects Super Admin status only -- it does NOT
  // know about per-Ekub admin assignment. A member should only ever be
  // able to WATCH a draw; only the Super Admin or the specific Ekub Admin
  // assigned to THIS Ekub should be able to launch it.
  const canExecuteDraw = isAdmin || ekub.adminId === userProfile?.uid;

  const [members, setMembers] = useState<EkubMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [stage, setStage] = useState<'idle' | 'countdown' | 'spinning' | 'revealed'>('idle');
  const [countdownNum, setCountdownNum] = useState(3);
  const [highlightedMemberName, setHighlightedMemberName] = useState('');
  const [winnerResult, setWinnerResult] = useState<EkubMember | null>(null);
  const [completedDraw, setCompletedDraw] = useState<Draw | null>(null);
  const [proofData, setProofData] = useState<any>(null);
  const [error, setError] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchEligible = async () => {
      setLoadingMembers(true);
      const all = await getEkubMembers(ekub.id);
      const safeAll = Array.isArray(all) ? all : [];
      // Eligible members: have paid and haven't received payout yet
      const eligible = safeAll.filter(m => !m.hasReceivedPayout && (m.eligibleForDraw || m.contributionStatus === 'paid'));
      setMembers(eligible.length > 0 ? eligible : safeAll.filter(m => !m.hasReceivedPayout));
      setLoadingMembers(false);
    };
    fetchEligible();
  }, [ekub.id]);

  const handleStartDraw = async () => {
    if (members.length === 0) {
      setError('No eligible participants remaining for this cycle.');
      return;
    }

    setError('');
    setStage('countdown');
    setCountdownNum(3);

    // 3-2-1 Countdown
    const timer = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          runSpinningAndExecute();
          return 0;
        }
        return prev - 1;
      });
    }, 900);
  };

  const runSpinningAndExecute = async () => {
    setStage('spinning');

    // Visual spinner cycling through member names
    let counter = 0;
    const spinInterval = setInterval(() => {
      const randomMember = members[counter % members.length];
      setHighlightedMemberName(randomMember.displayName);
      counter++;
    }, 100);

    try {
      // Server-authoritative cryptographic draw execution
      const { winner, draw, proof } = await executeDraw({
        ekubId: ekub.id,
        ekubName: ekub.name,
        cycleId: `cycle-${ekub.currentCycle}`,
        cycleNumber: ekub.currentCycle,
      });

      // Keep spinning for 2.5 seconds for suspense
      setTimeout(() => {
        clearInterval(spinInterval);
        setWinnerResult(winner);
        setCompletedDraw(draw);
        setProofData(proof);
        setStage('revealed');

        // Confetti celebration
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#7856FF', '#C4B5FD', '#1C1132', '#6340FF'],
        });

        onSuccess(draw);
      }, 2500);
    } catch (err: any) {
      clearInterval(spinInterval);
      setStage('idle');
      setError(err.message || 'Draw execution failed on server.');
    }
  };

  const handleCopyHash = () => {
    if (completedDraw?.verificationHash) {
      navigator.clipboard.writeText(completedDraw.verificationHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-[#1C1132] text-white max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] p-6 sm:p-8 shadow-2xl border border-[#7856FF]/30 rounded-2xl relative text-center overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[10px] font-bold uppercase tracking-[0.2em] mb-4 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-[#7856FF]" />
          <span>{t.liveDrawTitle}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {ekub.name}
        </h2>
        <p className="text-xs text-white/80 mt-1">
          Cycle #{ekub.currentCycle} Draw • Payout: <strong className="text-[#C4B5FD] font-mono">{ekub.payoutAmount.toLocaleString()} ETB</strong>
        </p>

        {error && (
          <div className="my-4 p-3 bg-red-900/50 border border-red-500/50 text-red-200 text-xs flex items-center justify-center space-x-2 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STAGE 1: IDLE / PREPARATION */}
        {stage === 'idle' && (
          <div className="mt-6 space-y-6">
            <div className="bg-white/5 p-5 border border-white/10 rounded-xl text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4B5FD]">
                  {t.eligibleCount}: {members.length}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/70">100% Equal Probability</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                {members.map((m) => (
                  <div key={m.userId} className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs truncate flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#7856FF] shrink-0" />
                    <span className="truncate">{m.displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-[#7856FF]/15 border border-[#7856FF]/30 rounded-xl text-left text-xs text-white/90">
              <div className="flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#7856FF] shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Cryptographic Guarantee:</strong> Winner selection is calculated on the server using HMAC-SHA256 with an independently verifiable commitment proof.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/10 border border-white/20 rounded-xl transition-all"
              >
                {t.cancel || 'Cancel'}
              </button>

              {canExecuteDraw ? (
                <button
                  type="button"
                  onClick={handleStartDraw}
                  disabled={loadingMembers || members.length === 0}
                  className="flex-1 py-3.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-xl active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 rounded-xl"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{language === 'am' ? 'ዕጣውን አሁን ጀምር' : 'Launch Live Draw'}</span>
                </button>
              ) : (
                <div className="flex-1 py-3.5 bg-white/5 border border-white/10 text-white/60 font-bold text-[11px] uppercase tracking-widest flex items-center justify-center space-x-2 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-[#7856FF]" />
                  <span>
                    {language === 'am'
                      ? 'የዕቁብ አስተዳዳሪ ዕጣውን እስኪጀምር ይጠብቁ'
                      : 'Waiting for the Ekub Admin to start this draw'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE 2: COUNTDOWN */}
        {stage === 'countdown' && (
          <div className="py-14 space-y-4">
            <div className="w-20 h-20 bg-[#7856FF]/20 border-2 border-[#7856FF] rounded-2xl flex items-center justify-center mx-auto text-4xl font-bold font-mono text-[#C4B5FD] animate-pulse">
              {countdownNum}
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
              {language === 'am' ? 'ዕጣው ሊጀመር ነው...' : 'Generating Cryptographic Server Entropy...'}
            </p>
          </div>
        )}

        {/* STAGE 3: SPINNING CAROUSEL */}
        {stage === 'spinning' && (
          <div className="py-12 space-y-6">
            <div className="w-14 h-14 bg-[#7856FF]/20 border border-[#7856FF]/40 rounded-xl flex items-center justify-center mx-auto animate-spin">
              <RotateCw className="w-6 h-6 text-[#7856FF]" />
            </div>

            <div className="p-4 bg-white/10 border border-white/20 rounded-xl max-w-sm mx-auto">
              <p className="text-[10px] uppercase tracking-wider text-white/60 mb-1">{t.drawingWinner}</p>
              <p className="text-xl font-bold text-[#C4B5FD] truncate">
                {highlightedMemberName || '...'}
              </p>
            </div>

            <p className="text-[10px] uppercase tracking-wider text-white/60">
              Computing HMAC-SHA256 modulo {members.length}...
            </p>
          </div>
        )}

        {/* STAGE 4: WINNER REVEALED */}
        {stage === 'revealed' && winnerResult && (
          <div className="py-6 space-y-6">
            <div className="w-16 h-16 bg-[#7856FF] text-white rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
              <Award className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C4B5FD] font-bold">
                {t.congratulations}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {winnerResult.displayName}
              </h3>
              <p className="text-xs text-white/80 mt-1">
                {t.winnerAnnounced}
              </p>
            </div>

            {/* Payout Metric */}
            <div className="bg-black/30 p-4 border border-white/10 rounded-xl max-w-sm mx-auto">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Guaranteed Pool Payout</p>
              <p className="text-2xl font-bold text-[#C4B5FD] font-mono mt-0.5">
                {ekub.payoutAmount.toLocaleString()} ETB
              </p>
            </div>

            {/* Verification Hash Badge */}
            {completedDraw?.verificationHash && (
              <div className="bg-white/5 p-3 border border-white/10 rounded-xl text-left text-xs space-y-1 max-w-md mx-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/60 font-mono">HMAC-SHA256 Hash:</span>
                  <button
                    onClick={handleCopyHash}
                    className="text-[10px] text-[#C4B5FD] uppercase tracking-wider font-bold hover:underline flex items-center space-x-1"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="font-mono text-[11px] text-white/90 truncate">
                  {completedDraw.verificationHash}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
              <button
                onClick={() => {
                  if (completedDraw) onOpenVerify(completedDraw);
                }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 flex items-center justify-center space-x-1.5 transition-colors rounded-xl"
              >
                <ShieldCheck className="w-4 h-4 text-[#7856FF]" />
                <span>{t.verifyDrawBtn}</span>
              </button>

              <button
                onClick={onClose}
                className="flex-1 py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-colors rounded-xl"
              >
                Close & Return
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
