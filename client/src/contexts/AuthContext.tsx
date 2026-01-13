import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInWithRedirect,
  signInWithPopup,
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
      // Try popup first (works better without Firebase Hosting)
      // eslint-disable-next-line no-console
      console.log("🚀 Attempting Google sign-in with popup...");
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const firebaseUser = result.user;
        if (firebaseUser) {
          // eslint-disable-next-line no-console
          console.log("✅ Google popup sign-in successful! User:", firebaseUser.email);
          await persistUserProfile(firebaseUser);
          setUser(firebaseUser);
          return firebaseUser;
        }
        return null;
      } catch (popupError: any) {
        // If popup fails (e.g., blocked or user closed), fall back to redirect
        // eslint-disable-next-line no-console
        console.warn("⚠️ Popup failed, falling back to redirect:", popupError);
        if (popupError.code === 'auth/popup-closed-by-user' || popupError.code === 'auth/popup-blocked') {
          // eslint-disable-next-line no-console
          console.log("🚀 Initiating Google sign-in redirect...");
          await signInWithRedirect(auth, googleProvider);
          // This function won't resolve normally because the page navigates away
          return null;
        }
        throw popupError;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("❌ Failed to initiate Google sign-in:", error);
      // eslint-disable-next-line no-console
      console.error("❌ Error details:", {
        code: error.code,
        message: error.message,
      });
      throw error; // Let the UI handle the error with a toast
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
    // Handle redirect result once on load (after user returns from Google sign-in).
    if (!redirectHandled.current) {
      redirectHandled.current = true;
      // eslint-disable-next-line no-console
      console.log("🔍 Checking for redirect result...");
      // eslint-disable-next-line no-console
      console.log("🔍 Current URL:", window.location.href);
      // eslint-disable-next-line no-console
      console.log("🔍 URL hash:", window.location.hash);
      // eslint-disable-next-line no-console
      console.log("🔍 URL search:", window.location.search);
      // eslint-disable-next-line no-console
      console.log("🔍 Full window.location:", {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        hash: window.location.hash,
        search: window.location.search,
      });
      
      // Small delay to ensure Firebase is ready
      setTimeout(() => {
        getRedirectResult(auth)
          .then(async (result) => {
            // eslint-disable-next-line no-console
            console.log("🔍 Redirect result:", result);
            if (result?.user) {
              // eslint-disable-next-line no-console
              console.log("✅ Google sign-in successful! User:", result.user.email);
              await persistUserProfile(result.user);
              setUser(result.user);
            } else {
              // eslint-disable-next-line no-console
              console.log("⚠️ No user in redirect result - user may have cancelled or redirect failed");
              // Check if there are any Firebase auth params in the URL
              const hashParams = new URLSearchParams(window.location.hash.substring(1));
              const searchParams = new URLSearchParams(window.location.search);
              // eslint-disable-next-line no-console
              console.log("🔍 Hash params:", Object.fromEntries(hashParams));
              // eslint-disable-next-line no-console
              console.log("🔍 Search params:", Object.fromEntries(searchParams));
              // eslint-disable-next-line no-console
              console.log("🔍 Auth state:", auth.currentUser);
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("❌ Google redirect login failed:", err);
            // eslint-disable-next-line no-console
            console.error("❌ Error details:", {
              code: err.code,
              message: err.message,
              stack: err.stack,
            });
          });
      }, 100);
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

