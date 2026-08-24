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
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOrganizer: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile from Firestore or initialize new member profile
  const fetchOrCreateProfile = async (firebaseUser: User, extraData?: Partial<UserProfile>) => {
    try {
      // Check if user is a designated super admin in /admins/{uid} or bootstrapped email
      let isDesignatedAdmin = firebaseUser.email === 'yared.abegaz@gmail.com';
      try {
        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
        if (adminDoc.exists()) {
          isDesignatedAdmin = true;
        } else if (isDesignatedAdmin) {
          // Self-seed admin document for super admin email
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            assignedAt: new Date().toISOString(),
            role: 'super_admin'
          });
        }
      } catch (adminErr) {
        // Fallback or unauthenticated check
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        if (isDesignatedAdmin && data.role !== 'super_admin') {
          data.role = 'super_admin';
        }
        setUserProfile(data);
        return data;
      } else {
        // New user profile: created with default 'member' role unless in /admins
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || extraData?.fullName || 'Yegna Member',
          email: firebaseUser.email || '',
          phoneNumber: extraData?.phoneNumber || '+251 91 123 4567',
          photoURL: firebaseUser.photoURL || '',
          role: isDesignatedAdmin ? 'super_admin' : 'member',
          preferredLanguage: 'en',
          preferredPaymentMethod: 'telebirr',
          verificationStatus: 'verified',
          createdAt: new Date().toISOString(),
        };
        if (extraData?.phoneNumber) newProfile.phoneNumber = extraData.phoneNumber;
        if (extraData?.fullName) newProfile.fullName = extraData.fullName;
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
        return newProfile;
      }
    } catch (err) {
      console.error('Failed to fetch/create user profile in Firestore:', err);
      setUserProfile(null);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateProfile(currentUser);
      } else {
        // Unauthenticated: no fabricated profiles or default admin
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (err: unknown) {
      console.error('Google Sign In failed:', err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (err: unknown) {
      console.error('Email Sign In failed:', err);
      throw err;
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
      console.error('Email Sign Up failed:', err);
      throw err;
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
      await fetchOrCreateProfile(user);
    }
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
