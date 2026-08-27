import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** @deprecated Equivalent to isSuperAdmin -- does NOT reflect per-Ekub admin
   *  status. Use App.tsx's hasAdminAccess (isSuperAdmin || is admin of some
   *  Ekub) for any UI that should be visible to Ekub Admins too. */
  isOrganizer: boolean;
  refreshProfile: () => Promise<void>;
  updateUserProfile: (updates: { fullName?: string; phoneNumber?: string; preferredLanguage?: 'en' | 'am'; preferredPaymentMethod?: UserProfile['preferredPaymentMethod'] }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export class NotInvitedError extends Error {
  constructor() {
    super('This account has not been invited to YegnaEkub yet. Please contact your Ekub Admin or the Super Admin for an invitation.');
    this.name = 'NotInvitedError';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load an existing user profile or initialize a new one for newly authenticated users
  const fetchOrCreateUserProfile = async (firebaseUser: User, customFullName?: string): Promise<UserProfile> => {
    const userEmail = (firebaseUser.email || '').toLowerCase().trim();
    let isDesignatedAdmin = userEmail === 'yared.abegaz@gmail.com';

    try {
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        isDesignatedAdmin = true;
      } else if (isDesignatedAdmin) {
        // Self-seed admin document for the bootstrap super admin email only.
        await setDoc(doc(db, 'admins', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: userEmail,
          assignedAt: new Date().toISOString(),
          role: 'super_admin'
        });
      }
    } catch (adminErr) {
      // Fallback if admins collection is not directly accessible
    }

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      if (isDesignatedAdmin && data.role !== 'super_admin') {
        data.role = 'super_admin';
        try {
          await updateDoc(userRef, { role: 'super_admin' });
        } catch (syncErr) {
          console.warn('Super admin role sync notice:', syncErr);
        }
      }
      return data;
    }

    // Initialize new profile for the user
    const resolvedName = customFullName?.trim() || firebaseUser.displayName || (userEmail ? userEmail.split('@')[0] : 'Member');
    const newProfile: UserProfile = {
      uid: firebaseUser.uid,
      fullName: isDesignatedAdmin && !customFullName ? (firebaseUser.displayName || 'Super Admin') : resolvedName,
      email: userEmail,
      phoneNumber: firebaseUser.phoneNumber || '',
      photoURL: firebaseUser.photoURL || '',
      role: isDesignatedAdmin ? 'super_admin' : 'member',
      preferredLanguage: 'en',
      preferredPaymentMethod: 'telebirr',
      verificationStatus: isDesignatedAdmin ? 'verified' : 'verified',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(userRef, newProfile);
    } catch (createErr) {
      console.warn('Profile write notice:', createErr);
    }

    return newProfile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profile = await fetchOrCreateUserProfile(currentUser);
          setUser(currentUser);
          setUserProfile(profile);
        } catch (err) {
          console.error('Profile check notice on auth state change:', err);
          setUser(currentUser);
          // Construct client fallback profile so UI remains operational
          const userEmail = (currentUser.email || '').toLowerCase().trim();
          const fallbackRole = userEmail === 'yared.abegaz@gmail.com' ? 'super_admin' : 'member';
          setUserProfile({
            uid: currentUser.uid,
            fullName: currentUser.displayName || (userEmail ? userEmail.split('@')[0] : 'User'),
            email: userEmail,
            phoneNumber: '',
            photoURL: currentUser.photoURL || '',
            role: fallbackRole,
            preferredLanguage: 'en',
            preferredPaymentMethod: 'telebirr',
            verificationStatus: 'verified',
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const profile = await fetchOrCreateUserProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      const profile = await fetchOrCreateUserProfile(result.user);
      setUser(result.user);
      setUserProfile(profile);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, fullName?: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      const profile = await fetchOrCreateUserProfile(result.user, fullName);
      setUser(result.user);
      setUserProfile(profile);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign Out failed:', err);
    }
    setUserProfile(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await fetchOrCreateUserProfile(user);
        setUserProfile(profile);
      } catch (err) {
        console.error('refreshProfile failed:', err);
      }
    }
  };

  // Lets a signed-in user update their own non-privileged profile fields.
  const updateUserProfile = async (updates: { fullName?: string; phoneNumber?: string; preferredLanguage?: 'en' | 'am'; preferredPaymentMethod?: UserProfile['preferredPaymentMethod'] }) => {
    if (!user) {
      throw new Error('You must be signed in to update your profile.');
    }
    const payload = { ...updates, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, 'users', user.uid), payload);
    setUserProfile(prev => (prev ? { ...prev, ...payload } : prev));
  };

  const isSuperAdmin = userProfile?.role === 'super_admin' || (userProfile?.role as string) === 'admin';
  const isAdmin = isSuperAdmin;
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
        isAdmin,
        isSuperAdmin,
        isOrganizer,
        refreshProfile,
        updateUserProfile,
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
