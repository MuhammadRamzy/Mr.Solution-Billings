import { cache } from "react";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { BusinessProfile, Client, Invoice, Counters, Expense } from "./types";

// Reads are memoized per-request via React's cache() so calling e.g.
// getBusinessProfile() from both the layout and a page only hits Firestore
// once. We deliberately do NOT cache across requests/instances: Vercel can
// route different requests to different serverless instances, and a
// module-level cache would serve stale data after a write lands on a
// different instance (looks like "my changes aren't saving").

const FIRESTORE_TIMEOUT_MS = 8000;

// Every Firestore call below is wrapped in this. Without it, a stalled
// connection (a known failure mode for the Firestore client SDK's
// gRPC/WebChannel transport in serverless environments) leaves the
// underlying promise pending forever - the calling server action just hangs
// and the UI shows an infinite spinner with no error. This forces a clear,
// catchable failure instead.
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Database ${label} timed out after ${FIRESTORE_TIMEOUT_MS / 1000}s. Check Firestore connectivity, project config, and security rules.`));
    }, FIRESTORE_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const DEFAULT_PROFILE: BusinessProfile = {
  name: "Mr.Solutions",
  tagline: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  taxId: "",
  phone: "",
  email: "",
  website: "",
  bank: {
    bankName: "",
    accountName: "",
    accountNo: "",
    ifscOrSwift: "",
    branch: "",
  },
  upiId: "",
  qrCodeUrl: "",
  paymentInstructions: "",
  logoUrl: "/logo_without_bg.png",
  invoicePrefix: "INV",
  quotePrefix: "QUO",
  currency: "INR",
  defaultTaxPercent: 0,
  defaultTaxLabel: "Tax",
  defaultPaymentDueDays: 14,
  defaultQuoteValidityDays: 14,
  termsAndConditions: "Payment is due within the period specified above. Thank you for your business!",
};

// Business Profile Operations
export const getBusinessProfile = cache(async (): Promise<BusinessProfile> => {
  try {
    const docRef = doc(db, "settings", "profile");
    const docSnap = await withTimeout(getDoc(docRef), "read (settings/profile)");
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...DEFAULT_PROFILE,
        ...data,
        bank: { ...DEFAULT_PROFILE.bank, ...(data.bank || {}) },
      } as BusinessProfile;
    }
  } catch (error) {
    console.error("Error reading business profile from Firestore:", error);
  }
  return DEFAULT_PROFILE;
});

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  await withTimeout(setDoc(doc(db, "settings", "profile"), profile), "write (settings/profile)");
}

// Client Operations
export const getClients = cache(async (): Promise<Client[]> => {
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, "clients")), "read (clients)");
    const list: Client[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Client));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error reading clients from Firestore:", error);
    return [];
  }
});

export async function saveClient(client: Client): Promise<void> {
  await withTimeout(setDoc(doc(db, "clients", client.id), client), "write (clients)");
}

export async function deleteClient(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, "clients", id)), "delete (clients)");
}

// Invoice Operations
export const getInvoices = cache(async (): Promise<Invoice[]> => {
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, "invoices")), "read (invoices)");
    const list: Invoice[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Invoice));
    return list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  } catch (error) {
    console.error("Error reading invoices from Firestore:", error);
    return [];
  }
});

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await withTimeout(setDoc(doc(db, "invoices", invoice.id), invoice), "write (invoices)");
}

export async function deleteInvoice(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, "invoices", id)), "delete (invoices)");
}

// Counters Operations
export const getCounters = cache(async (): Promise<Counters> => {
  const defaultCounters: Counters = { invoiceCounters: {}, quoteCounters: {} };
  try {
    const docRef = doc(db, "settings", "counters");
    const docSnap = await withTimeout(getDoc(docRef), "read (settings/counters)");
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { invoiceCounters: data.invoiceCounters || {}, quoteCounters: data.quoteCounters || {} };
    }
  } catch (error) {
    console.error("Error reading counters from Firestore:", error);
  }
  return defaultCounters;
});

export async function saveCounters(counters: Counters): Promise<void> {
  await withTimeout(setDoc(doc(db, "settings", "counters"), counters), "write (settings/counters)");
}

// Expense Operations
export const getExpenses = cache(async (): Promise<Expense[]> => {
  try {
    const querySnapshot = await withTimeout(getDocs(collection(db, "expenses")), "read (expenses)");
    const list: Expense[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Expense));
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Error reading expenses from Firestore:", error);
    return [];
  }
});

export async function saveExpense(expense: Expense): Promise<void> {
  await withTimeout(setDoc(doc(db, "expenses", expense.id), expense), "write (expenses)");
}

export async function deleteExpense(id: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, "expenses", id)), "delete (expenses)");
}

// Authentication Password Hash Operations
export async function getPasswordHash(): Promise<string> {
  try {
    const docRef = doc(db, "settings", "auth");
    const docSnap = await withTimeout(getDoc(docRef), "read (settings/auth)");
    if (docSnap.exists() && docSnap.data().passwordHash) {
      return docSnap.data().passwordHash;
    }
  } catch (error) {
    console.error("Error reading password hash from Firestore:", error);
  }
  // Default fallback password hash for "billing123" - change this immediately from Settings.
  const defaultHash = "c5ea86a08b0f74e49810b3bda1f3f2e286cc394056948cbd5fe4d627d46c0425";
  return defaultHash;
}

export async function savePasswordHash(hash: string): Promise<void> {
  await withTimeout(setDoc(doc(db, "settings", "auth"), { passwordHash: hash }), "write (settings/auth)");
}
