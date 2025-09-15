import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrOBWiqfpo4sNoYsF24KvhR9kp_p3dYiU",
  authDomain: "scrummy-be0d6.firebaseapp.com",
  projectId: "scrummy-be0d6",
  storageBucket: "scrummy-be0d6.firebasestorage.app",
  messagingSenderId: "309706610278",
  appId: "1:309706610278:web:d5f2c1d1644e360c5f7fa7"
};

// Initialize only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);