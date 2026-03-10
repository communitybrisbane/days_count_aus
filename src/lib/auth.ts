import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    // Try popup first (works on desktop browsers)
    return await signInWithPopup(auth, googleProvider);
  } catch (e: unknown) {
    const error = e as { code?: string };
    // Fallback to redirect if popup is blocked or unavailable
    if (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return signInWithRedirect(auth, googleProvider);
    }
    throw e;
  }
}

export async function signOut() {
  return firebaseSignOut(auth);
}
