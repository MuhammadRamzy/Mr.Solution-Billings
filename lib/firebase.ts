import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let dbInstance: Firestore;
try {
  // Serverless platforms (Vercel included) often run in network environments
  // where the Firestore SDK's default gRPC/WebChannel transport stalls or
  // never completes its handshake. Auto-detect was tried first, but on
  // Vercel writes were consistently hanging until timeout (confirmed via
  // direct testing: identical code writes in ~1s from a normal network but
  // hangs for the full 8s timeout from a Vercel function) while reads worked
  // fine - auto-detection was picking the wrong transport for the write/
  // commit stream specifically. Forcing long-polling skips that unreliable
  // detection probe entirely.
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  // initializeFirestore throws if it's already been called for this app
  // (e.g. dev-mode hot reload re-running this module) - reuse the instance.
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
