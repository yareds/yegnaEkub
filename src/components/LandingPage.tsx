import React, { useState } from 'react';
import { 
  Coins, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Users, 
  Calendar, 
  Lock, 
  FileCheck, 
  CheckCircle2, 
  Smartphone, 
  Building2, 
  BadgePercent,
  TrendingUp,
  Award
} from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';
import { ETHIOPIAN_BANK_ACCOUNTS } from '../data/demoData';
import { YegnaEkubLogo } from './YegnaEkubLogo';

interface LandingPageProps {
  onStartEkub: () => void;
  onJoinEkub: () => void;
  onExploreEkubs: () => void;
  onOpenLegal: () => void;
  /** Only a Super Admin can create an Ekub, so the "Start an Ekub" CTA is
   *  only meaningful for them. Defaults to false (safe default for the
   *  logged-out public landing page, where nobody's role is known yet). */
  isAdmin?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartEkub,
  onJoinEkub,
  onExploreEkubs,
  onOpenLegal,
  isAdmin = false,
}) => {
  const { t, language } = useTranslation();

  // Calculator State
  const [calcMembers, setCalcMembers] = useState<number>(10);
  const [calcContribution, setCalcContribution] = useState<number>(5000);
  const [calcFrequency, setCalcFrequency] = useState<'weekly' | 'monthly'>('weekly');

  const totalPot = calcMembers * calcContribution;
  const cycleDurationWeeks = calcFrequency === 'weekly' ? calcMembers : calcMembers * 4.3;

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#1C1132] text-white py-16 sm:py-20 border-b border-[#7856FF]/30 shadow-md rounded-2xl">
        {/* Subtle background motif */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#7856FF_1px,transparent_1px)] [background-size:24px_24px]" />
        
        {/* Glowing Mixpanel-style ambient gradient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#7856FF]/20 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Refined Brand Mark Showcase */}
          <div className="inline-flex items-center justify-center mb-6">
            <YegnaEkubLogo
              variant="full"
              size="lg"
              theme="dark"
              showSubtext={true}
              subtextText={language === 'am' ? 'ዲጂታል የዕቁብና የፋይናንስ ዕድገት መድረክ' : 'PROVABLY FAIR DIGITAL ROSCA PLATFORM'}
            />
          </div>

          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-[#7856FF]/20 border border-[#7856FF]/40 text-[#C4B5FD] text-[11px] font-bold uppercase tracking-[0.2em] mb-6 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-[#7856FF]" />
            <span>{language === 'am' ? 'የኢትዮጵያ ቀዳሚው ዲጂታል የዕቁብ መድረክ' : "Ethiopia's First Provably Fair Digital RoSCA"}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6 text-white">
            {t.heroHeadline}
          </h1>

          <p className="text-base sm:text-lg text-white/80 max-w-3xl mx-auto leading-relaxed mb-8">
            {t.heroSubheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            {isAdmin && (
              <button
                onClick={onStartEkub}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#7856FF]/25 transition-all flex items-center justify-center space-x-2 rounded-lg"
              >
                <Coins className="w-4 h-4" />
                <span>{t.startEkub}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onJoinEkub}
              className={`w-full sm:w-auto px-6 py-3.5 font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 rounded-lg ${
                isAdmin
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                  : 'bg-[#7856FF] hover:bg-[#6340FF] text-white shadow-lg shadow-[#7856FF]/25'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{t.joinEkub}</span>
              {!isAdmin && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick trust strip */}
          <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3">
              <p className="text-2xl font-light text-[#C4B5FD]">100%</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">Transparent Proofs</p>
            </div>
            <div className="p-3">
              <p className="text-2xl font-light text-[#C4B5FD]">0 ETB</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">Hidden Fees</p>
            </div>
            <div className="p-3">
              <p className="text-2xl font-light text-[#C4B5FD]">5+ Banks</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">Telebirr & CBE Ready</p>
            </div>
            <div className="p-3">
              <p className="text-2xl font-light text-[#C4B5FD]">1 Win</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">Per Member Guaranteed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Ekub Pot Calculator */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-6 sm:p-8 border border-[#E6E1F5] shadow-sm rounded-xl">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold mb-1">
              {language === 'am' ? 'የዕቁብ ስሌት መሞከሪያ' : 'Interactive Ekub Savings Calculator'}
            </h2>
            <p className="text-xs text-gray-600">
              {language === 'am' ? 'የአባላትን ብዛት እና የመዋጮ መጠን በመምረጥ የተሰበሰበውን ድምር ድረሻ አስላ።' : 'Simulate your pool payout, member turn duration, and total collected volume.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Input Controls */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5">
                  <span>{language === 'am' ? 'የአባላት ብዛት' : 'Circle Members'}:</span>
                  <span className="text-[#7856FF] font-bold">{calcMembers} Members</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={calcMembers}
                  onChange={(e) => setCalcMembers(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7856FF]"
                />
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 mt-1">
                  <span>3 (Small family)</span>
                  <span>10 (Standard)</span>
                  <span>30 (Commercial)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5">
                  <span>{language === 'am' ? 'የአንድ ዙር መዋጮ መጠን' : 'Contribution Per Member'}:</span>
                  <span className="text-[#7856FF] font-bold">{calcContribution.toLocaleString()} ETB</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCalcContribution(amt)}
                      className={`py-2 text-xs font-bold uppercase tracking-wider border rounded-lg transition-all ${
                        calcContribution === amt
                          ? 'bg-[#7856FF] text-white border-[#7856FF]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-[#F8F7FC]'
                      }`}
                    >
                      {amt.toLocaleString()} ETB
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1.5">
                  {language === 'am' ? 'የመክፈያ ድግግሞሽ' : 'Contribution Frequency'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCalcFrequency('weekly')}
                    className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border rounded-lg flex items-center justify-center space-x-2 transition-all ${
                      calcFrequency === 'weekly'
                        ? 'bg-[#7856FF]/10 border-[#7856FF] text-[#7856FF]'
                        : 'border-gray-200 text-gray-600 hover:bg-[#F8F7FC]'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-[#7856FF]" />
                    <span>{t.weekly}</span>
                  </button>

                  <button
                    onClick={() => setCalcFrequency('monthly')}
                    className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border rounded-lg flex items-center justify-center space-x-2 transition-all ${
                      calcFrequency === 'monthly'
                        ? 'bg-[#7856FF]/10 border-[#7856FF] text-[#7856FF]'
                        : 'border-gray-200 text-gray-600 hover:bg-[#F8F7FC]'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-[#7856FF]" />
                    <span>{t.monthly}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Output Card */}
            <div className="lg:col-span-5 bg-[#F3F0FA] border border-[#7856FF]/20 p-6 text-center shadow-sm rounded-xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold mb-1">
                {language === 'am' ? 'የእያንዳንዱ አባል ጠቅላላ ድረሻ' : 'Guaranteed Pool Payout'}
              </p>
              <div className="text-3xl sm:text-4xl font-bold text-[#1C1132] my-2">
                {totalPot.toLocaleString()} <span className="text-sm font-bold text-gray-600">ETB</span>
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Received exactly once by each of the {calcMembers} members.
              </p>

              <div className="bg-white p-3.5 border border-[#E6E1F5] rounded-lg text-left space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span className="text-[11px] uppercase tracking-wider">Cycle Duration:</span>
                  <span className="font-bold text-gray-900">{calcMembers} {calcFrequency === 'weekly' ? 'Weeks' : 'Months'}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="text-[11px] uppercase tracking-wider">Your Total Cost:</span>
                  <span className="font-bold text-gray-900">{totalPot.toLocaleString()} ETB (Net 0% loss)</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="text-[11px] uppercase tracking-wider">Platform Fee:</span>
                  <span className="font-bold text-green-600">0.00 ETB (Free)</span>
                </div>
              </div>

              {isAdmin ? (
                <button
                  onClick={onStartEkub}
                  className="w-full mt-5 py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-colors rounded-lg"
                >
                  {language === 'am' ? 'በዚህ ስሌት ዕቁብ ጀምር' : 'Launch Ekub With This Setup'}
                </button>
              ) : (
                <button
                  onClick={onJoinEkub}
                  className="w-full mt-5 py-3 bg-[#7856FF] hover:bg-[#6340FF] text-white font-bold text-xs uppercase tracking-widest shadow-md transition-colors rounded-lg"
                >
                  {language === 'am' ? 'ተመሳሳይ ዕቁብ ፈልግ ወይም ተቀላቀል' : 'Find or Join a Circle Like This'}
                </button>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* How YegnaEkub Works (6 Steps) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold">
            {t.howItWorks}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            {language === 'am' ? 'ከመዋጮ ጀምሮ እስከ ድረሻ ክፍያ ድረስ ያለው ግልጽ እና ደህንነቱ የተጠበቀ ሂደት።' : 'The end-to-end transparent workflow from initial pool formation to final cycle completion.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>1</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step1Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step1Desc}</p>
          </div>

          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>2</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step2Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step2Desc}</p>
          </div>

          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>3</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step3Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step3Desc}</p>
          </div>

          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>4</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step4Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step4Desc}</p>
          </div>

          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>5</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step5Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step5Desc}</p>
          </div>

          <div className="bg-white p-6 border border-[#E6E1F5] shadow-sm rounded-xl">
            <div className="w-8 h-8 bg-[#7856FF] text-white flex items-center justify-center font-bold text-xs rounded-lg mb-4">
              <span>6</span>
            </div>
            <h3 className="text-sm font-bold text-[#1C1132] mb-1.5">{t.step6Title}</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{t.step6Desc}</p>
          </div>
        </div>
      </section>

      {/* Trust & Transparency Section */}
      <section className="bg-white border-y border-[#E6E1F5] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-[#7856FF] uppercase tracking-[0.2em] mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7856FF]" />
              <span>{language === 'am' ? 'የታመነ የዲጂታል ደህንነት' : 'Uncompromising Governance'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1C1132]">
              {t.trustTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#F8F7FC] p-6 border border-[#E6E1F5] rounded-xl">
              <FileCheck className="w-7 h-7 text-[#7856FF] mb-3" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5">{t.pillar1Title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{t.pillar1Desc}</p>
            </div>

            <div className="bg-[#F8F7FC] p-6 border border-[#E6E1F5] rounded-xl">
              <Lock className="w-7 h-7 text-[#7856FF] mb-3" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5">{t.pillar2Title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{t.pillar2Desc}</p>
            </div>

            <div className="bg-[#F8F7FC] p-6 border border-[#E6E1F5] rounded-xl">
              <Sparkles className="w-7 h-7 text-[#7856FF] mb-3" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5">{t.pillar3Title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{t.pillar3Desc}</p>
            </div>

            <div className="bg-[#F8F7FC] p-6 border border-[#E6E1F5] rounded-xl">
              <Award className="w-7 h-7 text-[#7856FF] mb-3" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-1.5">{t.pillar4Title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{t.pillar4Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Identity & Growth Symbolism Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1C1132] text-white p-8 sm:p-10 border border-[#7856FF]/30 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#7856FF]/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
              <div className="p-4 bg-[#2B1B48] border border-[#7856FF]/40 rounded-2xl shadow-lg">
                <YegnaEkubLogo variant="mark" size="2xl" theme="dark" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C4B5FD]">Brand Mark Anatomy</span>
                <h3 className="text-lg font-bold text-white mt-1">The 'k' Growth Vector</h3>
                <p className="text-xs text-white/70 mt-1">Engineered to symbolize collective financial ascent and enterprise scaling.</p>
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#7856FF]/30 text-[#C4B5FD] flex items-center justify-center font-bold mb-2.5">
                  1
                </div>
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-1">Trust Pillar</h4>
                <p className="text-white/70 leading-relaxed">
                  The vertical stem grounds the system in institutional integrity, tamper-proof ledgers, and verified Ethiopian bank integrations.
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#7856FF]/30 text-[#C4B5FD] flex items-center justify-center font-bold mb-2.5">
                  2
                </div>
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-1">Community Base</h4>
                <p className="text-white/70 leading-relaxed">
                  The lower diagonal anchors democratic RoSCA peer governance, collective pooling, and social savings discipline.
                </p>
              </div>

              <div className="p-4 bg-white/5 border border-[#7856FF]/50 bg-[#7856FF]/10 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#7856FF] text-white flex items-center justify-center font-bold mb-2.5 shadow-xs">
                  3
                </div>
                <h4 className="font-bold text-[#C4B5FD] uppercase tracking-wider text-[11px] mb-1">Growth Arrow</h4>
                <p className="text-white/80 leading-relaxed">
                  The upper arm surges at 45° as a rising trend arrow, representing capital injection, business expansion, and wealth creation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Ethiopian Payment Gateways */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-[#7856FF] font-bold mb-1">
          {language === 'am' ? 'የሚደገፉ የኢትዮጵያ የክፍያ መንገዶች' : 'Supported Ethiopian Payment Gateways'}
        </h2>
        <p className="text-xs text-gray-600 mb-8 max-w-xl mx-auto">
          Direct manual & mobile-slip verification through top Ethiopian financial service providers.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {ETHIOPIAN_BANK_ACCOUNTS.map((bank) => (
            <div key={bank.code} className="bg-white p-4 border border-[#E6E1F5] rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
              <Building2 className="w-5 h-5 text-[#7856FF] mb-2" />
              <p className="text-xs font-bold text-gray-900">{(bank.name || '').split('(')[0]}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Acc: {bank.accountNumber}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Legal & Compliance Footer Disclaimer */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-6 bg-white border border-[#E6E1F5] rounded-2xl text-[11px] text-gray-500 leading-relaxed shadow-sm space-y-4">
          <div className="flex justify-center">
            <YegnaEkubLogo variant="full" size="sm" theme="light" showSubtext={true} subtextText="ETHIOPIAN DIGITAL ROSCA" />
          </div>
          <div className="border-t border-[#E6E1F5] pt-4">
            <p className="font-bold text-[#1C1132] uppercase tracking-wider mb-1">
              ⚖️ Legal & Regulatory Disclosure for Ethiopian RoSCA Platform:
            </p>
            <p>
              YegnaEkub operates as an informational software platform facilitating traditional, member-managed Ethiopian Ekub rotating savings agreements. YegnaEkub is not a licensed commercial bank, depository institution, or investment fund. All participants agree to the mutual community RoSCA agreement.
            </p>
            <button 
              onClick={onOpenLegal}
              className="text-[#7856FF] font-bold uppercase tracking-wider underline mt-2 hover:text-[#6340FF] inline-block"
            >
              Read Full Terms of Service, Ekub Agreement & Risk Disclosures
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
