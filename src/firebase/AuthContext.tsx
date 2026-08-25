import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
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
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** @deprecated Equivalent to isSuperAdmin -- does NOT reflect per-Ekub admin
   *  status. Use App.tsx's hasAdminAccess (isSuperAdmin || is admin of some
   *  Ekub) for any UI that should be visible to Ekub Admins too. */
  isOrganizer: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Thrown when a real Firebase Auth credential succeeds but the account has
// no corresponding users/{uid} profile and isn't the bootstrap Super Admin
// email -- i.e., nobody has invited this person to the platform yet. Public
// self-registration has been deliberately removed: the only way to get a
// profile is (a) being the bootstrap Super Admin email, or (b) having been
// invited via the inviteMember Cloud Function, which creates both the
// Firebase Auth account and the Firestore profile ahead of time.
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

  // Load an EXISTING user profile from Firestore. Does NOT create a new one
  // for an unrecognized account -- see NotInvitedError above. The one
  // exception is the bootstrap Super Admin email on its very first sign-in,
  // since there would otherwise be no way for anyone to ever become Super
  // Admin at all.
  const fetchProfileOrRejectUnknown = async (firebaseUser: User): Promise<UserProfile> => {
    // Check if user is a designated super admin in /admins/{uid} or bootstrapped email
    let isDesignatedAdmin = firebaseUser.email === 'yared.abegaz@gmail.com';
    try {
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        isDesignatedAdmin = true;
      } else if (isDesignatedAdmin) {
        // Self-seed admin document for the bootstrap super admin email only.
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
      return data;
    }

    if (isDesignatedAdmin) {
      // Bootstrap exception: the very first time the Super Admin email signs
      // in, there is by definition no existing profile and no one else who
      // could have invited them -- create it now.
      const bootstrapProfile: UserProfile = {
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || 'Super Admin',
        email: firebaseUser.email || '',
        phoneNumber: '',
        photoURL: firebaseUser.photoURL || '',
        role: 'super_admin',
        preferredLanguage: 'en',
        preferredPaymentMethod: 'telebirr',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, bootstrapProfile);
      return bootstrapProfile;
    }

    // No profile, not the bootstrap admin -- this account was never
    // invited. Do not create anything.
    throw new NotInvitedError();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profile = await fetchProfileOrRejectUnknown(currentUser);
          setUser(currentUser);
          setUserProfile(profile);
        } catch (err) {
          // Not invited (or a genuine Firestore error) -- do not leave a
          // signed-in Firebase Auth session with no usable profile. Sign
          // them back out so the app correctly returns to the logged-out
          // landing page rather than showing a broken/empty dashboard.
          console.error('Profile check failed on auth state change:', err);
          await firebaseSignOut(auth);
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
        const profile = await fetchProfileOrRejectUnknown(result.user);
        setUser(result.user);
        setUserProfile(profile);
      } catch (err) {
        await firebaseSignOut(auth);
        throw err;
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      try {
        const profile = await fetchProfileOrRejectUnknown(result.user);
        setUser(result.user);
        setUserProfile(profile);
      } catch (err) {
        await firebaseSignOut(auth);
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
        const profile = await fetchProfileOrRejectUnknown(user);
        setUserProfile(profile);
      } catch (err) {
        console.error('refreshProfile failed:', err);
      }
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
