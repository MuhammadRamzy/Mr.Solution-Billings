import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { BusinessProfile, Client, Invoice, Counters, Expense } from "./types";

// In-memory server cache to reduce Firestore reads.
let cachedProfile: BusinessProfile | null = null;
let cachedClients: Client[] | null = null;
let cachedInvoices: Invoice[] | null = null;
let cachedCounters: Counters | null = null;
let cachedExpenses: Expense[] | null = null;

let lastProfileFetch = 0;
let lastClientsFetch = 0;
let lastInvoicesFetch = 0;
let lastCountersFetch = 0;
let lastExpensesFetch = 0;

const CACHE_TTL = 60000; // 1 minute cache TTL

const isCacheValid = (lastFetch: number) => Date.now() - lastFetch < CACHE_TTL;

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
export async function getBusinessProfile(): Promise<BusinessProfile> {
  if (cachedProfile && isCacheValid(lastProfileFetch)) {
    return cachedProfile;
  }

  try {
    const docRef = doc(db, "settings", "profile");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      cachedProfile = {
        ...DEFAULT_PROFILE,
        ...data,
        bank: { ...DEFAULT_PROFILE.bank, ...(data.bank || {}) },
      } as BusinessProfile;
      lastProfileFetch = Date.now();
      return cachedProfile;
    }
  } catch (error) {
    console.error("Error reading business profile from Firestore:", error);
  }
  return DEFAULT_PROFILE;
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  await setDoc(doc(db, "settings", "profile"), profile);
  cachedProfile = profile;
  lastProfileFetch = Date.now();
}

// Client Operations
export async function getClients(): Promise<Client[]> {
  if (cachedClients && isCacheValid(lastClientsFetch)) {
    return cachedClients;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "clients"));
    const list: Client[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Client));

    const sorted = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    cachedClients = sorted;
    lastClientsFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading clients from Firestore:", error);
    return cachedClients || [];
  }
}

export async function saveClient(client: Client): Promise<void> {
  await setDoc(doc(db, "clients", client.id), client);
  cachedClients = null;
  lastClientsFetch = 0;
}

export async function deleteClient(id: string): Promise<void> {
  await deleteDoc(doc(db, "clients", id));
  cachedClients = null;
  lastClientsFetch = 0;
}

// Invoice Operations
export async function getInvoices(): Promise<Invoice[]> {
  if (cachedInvoices && isCacheValid(lastInvoicesFetch)) {
    return cachedInvoices;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "invoices"));
    const list: Invoice[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Invoice));

    const sorted = list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
    cachedInvoices = sorted;
    lastInvoicesFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading invoices from Firestore:", error);
    return cachedInvoices || [];
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  await setDoc(doc(db, "invoices", invoice.id), invoice);
  cachedInvoices = null;
  lastInvoicesFetch = 0;
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, "invoices", id));
  cachedInvoices = null;
  lastInvoicesFetch = 0;
}

// Counters Operations
export async function getCounters(): Promise<Counters> {
  const defaultCounters: Counters = { invoiceCounters: {}, quoteCounters: {} };

  if (cachedCounters && isCacheValid(lastCountersFetch)) {
    return cachedCounters;
  }

  try {
    const docRef = doc(db, "settings", "counters");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      cachedCounters = { invoiceCounters: data.invoiceCounters || {}, quoteCounters: data.quoteCounters || {} };
      lastCountersFetch = Date.now();
      return cachedCounters;
    }
  } catch (error) {
    console.error("Error reading counters from Firestore:", error);
  }
  return defaultCounters;
}

export async function saveCounters(counters: Counters): Promise<void> {
  await setDoc(doc(db, "settings", "counters"), counters);
  cachedCounters = counters;
  lastCountersFetch = Date.now();
}

// Expense Operations
export async function getExpenses(): Promise<Expense[]> {
  if (cachedExpenses && isCacheValid(lastExpensesFetch)) {
    return cachedExpenses;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "expenses"));
    const list: Expense[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Expense));

    const sorted = list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    cachedExpenses = sorted;
    lastExpensesFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading expenses from Firestore:", error);
    return cachedExpenses || [];
  }
}

export async function saveExpense(expense: Expense): Promise<void> {
  await setDoc(doc(db, "expenses", expense.id), expense);
  cachedExpenses = null;
  lastExpensesFetch = 0;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", id));
  cachedExpenses = null;
  lastExpensesFetch = 0;
}

// Authentication Password Hash Operations
export async function getPasswordHash(): Promise<string> {
  try {
    const docRef = doc(db, "settings", "auth");
    const docSnap = await getDoc(docRef);
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
  await setDoc(doc(db, "settings", "auth"), { passwordHash: hash });
}
