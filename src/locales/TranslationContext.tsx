import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from './en';
import { am } from './am';

type Language = 'en' | 'am';
type TranslationDict = typeof en;

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: TranslationDict;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('yegna_ekub_lang');
    return (saved === 'am' || saved === 'en') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('yegna_ekub_lang', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === 'en' ? 'am' : 'en'));
  };

  const t = language === 'am' ? (am as TranslationDict) : en;

  return (
    <TranslationContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
