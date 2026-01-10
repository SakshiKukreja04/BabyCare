import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db, googleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<User | null>;
  signupWithEmail: (name: string, email: string, password: string) => Promise<User>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const redirectHandled = useRef(false);

  // Ensure user profile exists in Firestore after Google sign-in.
  const persistUserProfile = async (firebaseUser: User) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        name: firebaseUser.displayName || "Anonymous",
        email: firebaseUser.email || "",
        createdAt: serverTimestamp(),
      });
    }
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      if (firebaseUser) {
        await persistUserProfile(firebaseUser);
        setUser(firebaseUser);
      }
      return firebaseUser;
    } catch (error) {
      // Popup errors can occur due to COOP/window.close policies; fallback to redirect.
      // eslint-disable-next-line no-console
      console.warn("Google popup failed, falling back to redirect:", error);
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
  };

  const signupWithEmail = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;

    // Set display name for the user so it shows up consistently.
    if (name && !firebaseUser.displayName) {
      await updateProfile(firebaseUser, { displayName: name });
    }

    await persistUserProfile(firebaseUser);
    setUser(firebaseUser);
    return firebaseUser;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;
    setUser(firebaseUser);
    return firebaseUser;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  useEffect(() => {
    // Handle redirect result once on load (covers popup fallback).
    if (!redirectHandled.current) {
      redirectHandled.current = true;
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user) {
            await persistUserProfile(result.user);
            setUser(result.user);
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Google redirect login failed:", err);
        });
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      // 🔑 LOG TOKEN FOR POSTMAN TESTING - Remove in production!
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        console.log("🔑 ====================== BEARER TOKEN ======================");
        console.log("🔑 Copy this token for Postman:");
        console.log(token);
        console.log("🔑 ===========================================================");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        signupWithEmail,
        loginWithEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

