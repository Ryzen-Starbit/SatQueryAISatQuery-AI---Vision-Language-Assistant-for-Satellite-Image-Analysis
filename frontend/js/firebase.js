import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getFirestore,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDYLgyJJNQZnYvBtolPWmS0QzPEX2OwUiI",
  authDomain: "satquery-ai-7f3a3.firebaseapp.com",
  projectId: "satquery-ai-7f3a3",
  storageBucket: "satquery-ai-7f3a3.firebasestorage.app",
  messagingSenderId: "412256142146",
  appId: "1:412256142146:web:dcc7f33dfddc803d443edb",
  measurementId: "G-1ZJE58F8TG",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "satquery");
const googleProvider = new GoogleAuthProvider();

function toSessionUser(user) {
  return {
    id: user.uid,
    name: user.displayName || user.email.split("@")[0],
    email: user.email,
  };
}

window.SatQueryFirebase = {
  async signIn(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return createSession(result.user);
  },

  async signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    return createSession(result.user);
  },

  signOut() {
    return signOut(auth);
  },
};

async function createSession(user) {
  const sessionUser = toSessionUser(user);
  const userRef = doc(db, "users", user.uid);
  const existingProfile = await getDoc(userRef);
  const profile = {
    uid: user.uid,
    name: sessionUser.name,
    email: sessionUser.email,
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp(),
  };
  if (!existingProfile.exists()) {
    profile.createdAt = serverTimestamp();
  }
  await setDoc(userRef, profile, { merge: true });

  return {
    user: sessionUser,
    token: await user.getIdToken(),
  };
}
