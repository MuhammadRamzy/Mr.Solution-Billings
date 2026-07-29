import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// The Firestore *client* SDK (firebase/firestore) is built for browsers and
// was being used here entirely server-side. In Vercel's serverless Node
// runtime its WebChannel/long-polling transport reliably hung on writes
// (confirmed: identical write code completed in ~1s outside Vercel but hung
// for the full configured timeout every time as a Vercel function, even
// after forcing long-polling). The Admin SDK talks to Firestore over native
// gRPC meant for server environments and doesn't have this failure mode.
//
// Credentials are three separate env vars rather than one JSON blob - a
// single-line JSON string containing a multi-line PEM private key is fragile
// to paste into a web form (confirmed: it broke twice pasting into Vercel's
// dashboard, since real newlines and JSON string-escaped newlines look
// identical but aren't). A plain env var holding just the key, with escaped
// \n sequences un-escaped in code, survives copy/paste intact either way.
function getCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error("FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must all be set");
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return { projectId, clientEmail, privateKey };
}

const app: App = getApps().length === 0 ? initializeApp({ credential: cert(getCredential()) }) : getApps()[0];

export const adminDb: Firestore = getFirestore(app);
