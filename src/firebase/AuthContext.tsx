import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
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

  // Load an existing user profile or initialize the bootstrap super admin
  const loadUserProfile = async (firebaseUser: User): Promise<UserProfile> => {
    const userEmail = (firebaseUser.email || '').toLowerCase().trim();
    const isBootstrapAdmin = userEmail === 'yared.abegaz@gmail.com';

    // Seed /admins doc for bootstrap email if not present
    if (isBootstrapAdmin) {
      try {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminDoc = await getDoc(adminRef);
        if (!adminDoc.exists()) {
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email: userEmail,
            assignedAt: new Date().toISOString(),
            role: 'super_admin',
          });
        }
      } catch (adminErr) {
        console.warn('Admins collection check/seed notice:', adminErr);
      }
    }

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      if (isBootstrapAdmin && data.role !== 'super_admin') {
        data.role = 'super_admin';
        try {
          await updateDoc(userRef, { role: 'super_admin' });
        } catch (syncErr) {
          console.warn('Super admin role sync notice:', syncErr);
        }
      }
      return data;
    }

    // If the signed-in account is the bootstrap Super Admin email and has no profile yet, create one
    if (isBootstrapAdmin) {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || 'Super Admin',
        email: userEmail,
        phoneNumber: firebaseUser.phoneNumber || '',
        photoURL: firebaseUser.photoURL || '',
        role: 'super_admin',
        preferredLanguage: 'en',
        preferredPaymentMethod: 'telebirr',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    }

    // For every other case: throw NotInvitedError
    throw new NotInvitedError();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profile = await loadUserProfile(currentUser);
          setUser(currentUser);
          setUserProfile(profile);
        } catch (err) {
          console.error('Profile check notice on auth state change:', err);
          try {
            await firebaseSignOut(auth);
          } catch (signOutErr) {
            console.error('Sign out error:', signOutErr);
          }
          setUser(null);
          setUserProfile(null);
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
      try {
        const profile = await loadUserProfile(result.user);
        setUser(result.user);
        setUserProfile(profile);
      } catch (err) {
        try {
          await firebaseSignOut(auth);
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }
        setUser(null);
        setUserProfile(null);
        throw err;
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      try {
        const profile = await loadUserProfile(result.user);
        setUser(result.user);
        setUserProfile(profile);
      } catch (err) {
        try {
          await firebaseSignOut(auth);
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }
        setUser(null);
        setUserProfile(null);
        throw err;
      }
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
        const profile = await loadUserProfile(user);
        setUserProfile(profile);
      } catch (err) {
        console.error('refreshProfile failed:', err);
        try {
          await firebaseSignOut(auth);
        } catch (signOutErr) {
          console.error('Sign out error:', signOutErr);
        }
        setUser(null);
        setUserProfile(null);
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

  const isSuperAdmin = userProfile?.role === 'super_admin' || (userProfile?.role as string) === 'admin' || ((user?.email || '').toLowerCase().trim() === 'yared.abegaz@gmail.com');
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
