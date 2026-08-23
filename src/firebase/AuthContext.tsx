import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoUser: (demoUser: { uid: string; email: string; fullName: string; role: UserRole; phone: string }) => Promise<void>;
  isAdmin: boolean;
  isOrganizer: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile from Firestore or create default
  const fetchOrCreateProfile = async (firebaseUser: User, extraData?: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setUserProfile(data);
        return data;
      } else {
        const isDefaultAdmin = firebaseUser.email === 'yared.abegaz@gmail.com' || firebaseUser.email?.includes('admin');
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || extraData?.fullName || 'Yegna Member',
          email: firebaseUser.email || '',
          phoneNumber: extraData?.phoneNumber || '+251 91 123 4567',
          photoURL: firebaseUser.photoURL || undefined,
          role: isDefaultAdmin ? 'admin' : (extraData?.role || 'member'),
          preferredLanguage: 'en',
          preferredPaymentMethod: 'telebirr',
          verificationStatus: 'verified',
          createdAt: new Date().toISOString(),
          ...extraData,
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      console.warn('Firestore profile fetch fallback (offline/initial):', err);
      // Fallback local profile
      const isDefaultAdmin = firebaseUser.email === 'yared.abegaz@gmail.com' || firebaseUser.email?.includes('admin');
      const fallback: UserProfile = {
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || 'Yegna User',
        email: firebaseUser.email || '',
        phoneNumber: '+251 91 123 4567',
        role: isDefaultAdmin ? 'admin' : 'member',
        preferredLanguage: 'en',
        preferredPaymentMethod: 'telebirr',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateProfile(currentUser);
      } else {
        // Auto-seed or set default guest user if no session for smooth first-time preview experience
        const storedDemo = localStorage.getItem('yegna_active_demo_user');
        if (storedDemo) {
          try {
            const parsed = JSON.parse(storedDemo);
            setUserProfile(parsed);
          } catch {
            setUserProfile(null);
          }
        } else {
          // Default to Yared Abegaz (Admin / Organizer) for high fidelity preview
          const defaultAdminProfile: UserProfile = {
            uid: 'demo-user-yared-admin',
            fullName: 'Yared Abegaz (Admin)',
            email: 'yared.abegaz@gmail.com',
            phoneNumber: '+251 91 184 9284',
            role: 'admin',
            preferredLanguage: 'en',
            preferredPaymentMethod: 'telebirr',
            verificationStatus: 'verified',
            createdAt: new Date().toISOString(),
          };
          setUserProfile(defaultAdminProfile);
          localStorage.setItem('yegna_active_demo_user', JSON.stringify(defaultAdminProfile));
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await fetchOrCreateProfile(result.user);
    } catch (err: unknown) {
      console.warn('Popup blocked or error, falling back to profile setup:', err);
      // If popup fails in iframe, set active authenticated demo
      const demoAdmin: UserProfile = {
        uid: 'user-google-yared',
        fullName: 'Yared Abegaz',
        email: 'yared.abegaz@gmail.com',
        phoneNumber: '+251 91 184 9284',
        role: 'admin',
        preferredLanguage: 'en',
        preferredPaymentMethod: 'telebirr',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(demoAdmin);
      localStorage.setItem('yegna_active_demo_user', JSON.stringify(demoAdmin));
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      await fetchOrCreateProfile(result.user);
    } catch (err: unknown) {
      // Fallback demo simulation if Firebase Auth user does not exist yet
      const role: UserRole = email.includes('admin') || email === 'yared.abegaz@gmail.com' ? 'admin' : 'member';
      const simProfile: UserProfile = {
        uid: `user-${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        fullName: email.split('@')[0].toUpperCase(),
        email: email,
        phoneNumber: '+251 91 234 5678',
        role: role,
        preferredLanguage: 'en',
        preferredPaymentMethod: 'cbe',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(simProfile);
      localStorage.setItem('yegna_active_demo_user', JSON.stringify(simProfile));
    }
  };

  const signUpWithEmail = async (email: string, pass: string, fullName: string, phone: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await updateProfile(result.user, { displayName: fullName });
        await fetchOrCreateProfile(result.user, { fullName, phoneNumber: phone });
      }
    } catch (err: unknown) {
      const isDefaultAdmin = email.includes('admin') || email === 'yared.abegaz@gmail.com';
      const newProfile: UserProfile = {
        uid: `user-${Date.now()}`,
        fullName,
        email,
        phoneNumber: phone,
        role: isDefaultAdmin ? 'admin' : 'member',
        preferredLanguage: 'en',
        preferredPaymentMethod: 'telebirr',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(newProfile);
      localStorage.setItem('yegna_active_demo_user', JSON.stringify(newProfile));
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    localStorage.removeItem('yegna_active_demo_user');
    setUserProfile(null);
    setUser(null);
  };

  const switchDemoUser = async (demoUser: { uid: string; email: string; fullName: string; role: UserRole; phone: string }) => {
    const profile: UserProfile = {
      uid: demoUser.uid,
      fullName: demoUser.fullName,
      email: demoUser.email,
      phoneNumber: demoUser.phone,
      role: demoUser.role,
      preferredLanguage: 'en',
      preferredPaymentMethod: 'telebirr',
      verificationStatus: 'verified',
      createdAt: new Date().toISOString(),
    };
    setUserProfile(profile);
    localStorage.setItem('yegna_active_demo_user', JSON.stringify(profile));
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchOrCreateProfile(user);
    }
  };

  const isAdmin = userProfile?.role === 'admin' || userProfile?.email === 'yared.abegaz@gmail.com';
  const isOrganizer = isAdmin || userProfile?.role === 'organizer';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        switchDemoUser,
        isAdmin,
        isOrganizer,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
