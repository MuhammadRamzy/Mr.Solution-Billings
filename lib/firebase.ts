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
  // never completes its handshake. Auto-detecting long-polling avoids that -
  // it's the standard fix for Firestore client SDK use in serverless backends.
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  // initializeFirestore throws if it's already been called for this app
  // (e.g. dev-mode hot reload re-running this module) - reuse the instance.
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
