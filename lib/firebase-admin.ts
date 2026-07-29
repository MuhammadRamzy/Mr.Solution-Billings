import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// The Firestore *client* SDK (firebase/firestore) is built for browsers and
// was being used here entirely server-side. In Vercel's serverless Node
// runtime its WebChannel/long-polling transport reliably hung on writes
// (confirmed: identical write code completed in ~1s outside Vercel but hung
// for the full configured timeout every time as a Vercel function, even
// after forcing long-polling). The Admin SDK talks to Firestore over native
// gRPC meant for server environments and doesn't have this failure mode.
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  }
  return JSON.parse(raw);
}

const app: App = getApps().length === 0 ? initializeApp({ credential: cert(getServiceAccount()) }) : getApps()[0];

export const adminDb: Firestore = getFirestore(app);
