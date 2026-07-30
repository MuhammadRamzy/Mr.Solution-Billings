# Contractor & Contract Management (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Contractors directory and a Contract entity to Systemiq's billing app, so an accepted quote can become an internal delivery contract with an assigned team, milestones, contractor payments, and a live profit calculation — without touching invoicing/quoting behavior that already works.

**Architecture:** Two new Firestore collections (`contractors`, `contracts`) accessed through the existing `lib/db.ts` Admin SDK + React `cache()` pattern. A new `app/contractActions.ts` "use server" file (sibling to `app/actions.ts`, not merged into it — that file is already large) holds all mutations, each returning `{ success, error }` instead of throwing, matching every existing action. UI follows the two closest existing patterns 1:1: Contractors mirror Clients (list + modal dialog, `components/ClientsList.tsx` / `ClientDialog.tsx`), Contracts mirror Invoices (list + full-page create/edit form + full-page detail view, `components/InvoicesList.tsx` / `InvoiceForm.tsx` / `InvoiceDetailView.tsx`).

**Tech Stack:** Next.js 16.2.10 App Router, React 19, Zod 4, Firestore via `firebase-admin`, Tailwind v4, `lucide-react` icons. No test framework is installed (see Global Constraints).

## Global Constraints

- **This project has no unit test framework** (`package.json` has no Jest/Vitest/Playwright dependency — confirmed by reading it directly). "Write the failing test" steps below are adapted to this project's actual, established verification convention instead of introducing a new one:
  1. After every code change: `npx tsc --noEmit -p tsconfig.json` must be clean.
  2. After every task that touches server code: `npm run build` must succeed.
  3. For every task with user-facing behavior: write a throwaway Playwright script (`playwright-core`, already used ad-hoc all over this project's history — install with `npm install playwright-core --no-save` if `node_modules/playwright-core` is missing) that logs in via a forged session cookie (see "Auth for scripts" below), drives the real dev/prod build against the **real Firestore project** (credentials already in `.env.local`), and asserts on real DOM state. Delete the script when the task is verified — none of this project's history has committed test files, and that convention holds here too.
- **Auth for scripts:** sign an HMAC session cookie locally instead of logging in through the UI:
  ```js
  import { webcrypto as crypto } from "crypto";
  import fs from "fs";
  const envText = fs.readFileSync("/home/mhdramzy/projects/MyBilling/.env.local", "utf-8");
  const SECRET = envText.match(/^SESSION_SECRET=(.*)$/m)[1].trim();
  async function signSession(payload) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
    const sigHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${Buffer.from(JSON.stringify(payload)).toString("base64")}.${sigHex}`;
  }
  const token = await signSession({ authenticated: true, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  // context.addCookies([{ name: "session", value: token, url: "http://localhost:3007", httpOnly: true, sameSite: "Lax" }])
  ```
- **Any test data written to Firestore during verification must be deleted afterward** using the Admin SDK (see any `lib/db.ts` read function for the credential-loading pattern — `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` from `.env.local`, `privateKey.replace(/\\n/g, "\n")`). Never leave test Contractors/Contracts in the production Firestore project.
- **Every Server Action must catch its own errors and return `{ success: false as const, error: string }`** — never throw. Next.js redacts thrown Server Action error messages in production builds, which previously caused a real, hard-to-diagnose "infinite spinner" bug in this exact app. Use the same `errorMessage(error, fallback)` helper pattern already in `app/actions.ts:45-48`.
- **Currency formatting:** always use `formatCurrency` from `@/lib/utils` (never hand-roll `₹` string interpolation).
- **No tax fields anywhere** — this business does not collect tax (removed everywhere in a prior pass). Do not add `taxPercent`/`taxAmount` to any new schema.
- **Mobile-first, no horizontal overflow:** every new list/table must follow the pattern already established in `components/InvoicesList.tsx` — a card-based layout below `xl:` (1280px) and a table only at `xl:` and above (tablets get the card layout; a data table needs real desktop width). Action button rows must never rely on unconstrained `flex-wrap` — see the fix in `components/InvoiceDetailView.tsx` (mobile actions live in their own non-wrapping row with a `relative`-positioned "More" menu whose trigger is guaranteed to be near the right edge).
- **Firestore documents are fully replaced on save** (`.set()`, not `.update()`) — every mutation reads the current document (or list), merges in memory, validates the whole thing with the relevant Zod schema, and writes the whole thing back. This is the pattern in every existing action (e.g. `recordPaymentAction` in `app/actions.ts:373-421`); Contract mutations (assignments, milestones, contractor payments) follow it exactly rather than using Firestore array-union operators.

---

### Task 1: Extend schemas — Contractor, Contract, and related sub-schemas

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `ContractorSchema`, `Contractor` type; `ContractAssignmentSchema`, `ContractAssignment` type; `ContractMilestoneSchema`, `ContractMilestone` type; `ContractorPaymentSchema`, `ContractorPayment` type; `ContractSchema`, `Contract` type. Also adds `convertedToContractId` to `InvoiceSchema`, `contractCounters` to `CountersSchema`, `contractPrefix` to `BusinessProfileSchema`.

- [ ] **Step 1: Add the new schemas to `lib/types.ts`**

Insert after the existing `ExpenseSchema` block (currently ends at line 155, right before the `// TypeScript type inference` comment):

```ts
export const ContractorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Contractor name is required"),
  email: z.string().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable().or(z.literal("")),
  college: z.string().optional().nullable().or(z.literal("")),
  skills: z.array(z.string()).default([]),
  primaryRole: z.string().optional().nullable().or(z.literal("")),
  hourlyRate: z.number().nonnegative().default(0),
  sprintRate: z.number().nonnegative().default(0),
  preferredPaymentMethod: z.enum(["cash", "bank", "card", "upi", "paypal", "other"]).default("bank"),
  bank: BankSchema,
  upiId: z.string().optional().nullable().or(z.literal("")),
  panNumber: z.string().optional().nullable().or(z.literal("")),
  status: z.enum(["active", "busy", "inactive"]).default("active"),
  notes: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// One row per person assigned to a contract - a contract can have several,
// a contractor can be on several contracts at once (workload is derived by
// counting Contract documents that reference a given contractorId, not
// stored on the contractor itself).
export const ContractAssignmentSchema = z.object({
  contractorId: z.string().uuid(),
  contractorName: z.string(),
  role: z.string().min(1, "Role is required"),
  allocatedAmount: z.number().nonnegative().default(0),
});

export const ContractMilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Milestone title is required"),
  amount: z.number().nonnegative().default(0),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "paid"]).default("pending"),
  notes: z.string().optional().nullable().or(z.literal("")),
});

// What Systemiq pays a contractor - independent of what the client pays
// Systemiq (that's still the existing Invoice/Payment flow).
export const ContractorPaymentSchema = z.object({
  id: z.string().uuid(),
  contractorId: z.string().uuid(),
  contractorName: z.string(),
  amount: z.number().positive("Payment amount must be greater than 0"),
  date: z.string(),
  method: z.enum(["cash", "bank", "card", "upi", "paypal", "other"]),
  note: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
});

// Phase 1 status flow is deliberately shorter than a full studio workflow:
// draft -> assigned -> in_progress -> delivered -> completed, with paused/
// cancelled as escape hatches. Contractor-facing states (accepted by
// contractor, QA review, client-portal approval) need contractor logins or
// a QA subsystem neither of which exist yet - adding those states now would
// just be dead UI. Extend this enum when those phases actually get built.
export const ContractSchema = z.object({
  id: z.string().uuid(),
  contractNo: z.string(),
  year: z.string(),
  sequence: z.number().int().positive(),
  projectName: z.string().min(1, "Project name is required"),
  clientId: z.string().uuid(),
  clientSnapshot: z.object({
    name: z.string(),
    companyName: z.string().optional().nullable(),
  }),
  sourceQuoteId: z.string().uuid().optional().nullable(),
  contractType: z.enum(["fixed", "milestone", "hourly", "retainer"]).default("fixed"),
  status: z.enum(["draft", "assigned", "in_progress", "delivered", "completed", "paused", "cancelled"]).default("draft"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  startDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  contractValue: z.number().nonnegative().default(0),
  assignments: z.array(ContractAssignmentSchema).default([]),
  milestones: z.array(ContractMilestoneSchema).default([]),
  contractorPayments: z.array(ContractorPaymentSchema).default([]),
  repositoryLink: z.string().optional().nullable().or(z.literal("")),
  deploymentUrl: z.string().optional().nullable().or(z.literal("")),
  figmaLink: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable().or(z.literal("")),
  clientNotes: z.string().optional().nullable().or(z.literal("")),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

Then update the `// TypeScript type inference` block at the bottom of the file to add:

```ts
export type Contractor = z.infer<typeof ContractorSchema>;
export type ContractAssignment = z.infer<typeof ContractAssignmentSchema>;
export type ContractMilestone = z.infer<typeof ContractMilestoneSchema>;
export type ContractorPayment = z.infer<typeof ContractorPaymentSchema>;
export type Contract = z.infer<typeof ContractSchema>;
```

- [ ] **Step 2: Add `convertedToContractId` to `InvoiceSchema`**

In `lib/types.ts`, find this line inside `InvoiceSchema` (currently line 116):

```ts
  convertedFromQuoteId: z.string().uuid().optional().nullable(),
```

Change it to:

```ts
  convertedFromQuoteId: z.string().uuid().optional().nullable(),
  convertedToContractId: z.string().uuid().optional().nullable(),
```

- [ ] **Step 3: Add `contractCounters` to `CountersSchema`**

Find (currently lines 126-129):

```ts
export const CountersSchema = z.object({
  invoiceCounters: z.record(z.string(), z.number()).default({}),
  quoteCounters: z.record(z.string(), z.number()).default({}),
});
```

Change to:

```ts
export const CountersSchema = z.object({
  invoiceCounters: z.record(z.string(), z.number()).default({}),
  quoteCounters: z.record(z.string(), z.number()).default({}),
  contractCounters: z.record(z.string(), z.number()).default({}),
});
```

- [ ] **Step 4: Add `contractPrefix` to `BusinessProfileSchema`**

Find this line inside `BusinessProfileSchema` (currently line 31):

```ts
  quotePrefix: z.string().default("QUO"),
```

Change to:

```ts
  quotePrefix: z.string().default("QUO"),
  contractPrefix: z.string().default("SYS-CON"),
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`

This will show errors in every file that builds an `Invoice` or `BusinessProfile` object literal without the two new optional/defaulted fields — there should be none, since both new fields are optional/defaulted and every existing invoice-building code path spreads `...existingInvoice` or uses `InvoiceSchema.parse()`/`BusinessProfileSchema.parse()` rather than hand-listing every field. If you do see an error, it will name the exact file and line; add the missing field there (e.g. `convertedToContractId: null` next to the existing `convertedFromQuoteId: null` in `app/actions.ts`'s `createInvoiceAction`).

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts
git commit -m "Add Contractor and Contract schemas"
```

---

### Task 2: Contract budget/profit calculation helper

**Files:**
- Create: `lib/contractCalculations.ts`

**Interfaces:**
- Consumes: `Contract["assignments"]`, `Contract["contractorPayments"]`, `Contract["contractValue"]` from Task 1; `roundToTwoDecimals` from `lib/calculations.ts` (already exported there).
- Produces: `calculateContractBudget(contract): ContractBudget` where `ContractBudget = { totalAllocated: number; totalPaid: number; totalPending: number; estimatedProfit: number; profitMarginPercent: number }`.

- [ ] **Step 1: Write `lib/contractCalculations.ts`**

```ts
import { roundToTwoDecimals } from "./calculations";
import { ContractAssignment, ContractorPayment } from "./types";

export interface ContractBudget {
  totalAllocated: number;
  totalPaid: number;
  totalPending: number;
  estimatedProfit: number;
  profitMarginPercent: number;
}

interface ContractBudgetInput {
  contractValue: number;
  assignments: ContractAssignment[];
  contractorPayments: ContractorPayment[];
}

/**
 * Contract-level profitability: contractValue is what the client pays
 * Systemiq (copied from the source quote, or entered manually). Allocated
 * amounts are the planned contractor cost per assignment; payments are what
 * has actually been paid out so far. Distinct from invoice payments, which
 * track what the *client* has paid Systemiq.
 */
export function calculateContractBudget(input: ContractBudgetInput): ContractBudget {
  const totalAllocated = roundToTwoDecimals(input.assignments.reduce((sum, a) => sum + a.allocatedAmount, 0));
  const totalPaid = roundToTwoDecimals(input.contractorPayments.reduce((sum, p) => sum + p.amount, 0));
  const totalPending = roundToTwoDecimals(Math.max(totalAllocated - totalPaid, 0));
  const estimatedProfit = roundToTwoDecimals(input.contractValue - totalAllocated);
  const profitMarginPercent = input.contractValue === 0 ? 0 : roundToTwoDecimals((estimatedProfit / input.contractValue) * 100);

  return { totalAllocated, totalPaid, totalPending, estimatedProfit, profitMarginPercent };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Verify the math with a throwaway script**

Create `/tmp/claude-1000/-home-mhdramzy-projects-MyBilling/*/scratchpad/verify-budget-calc.mjs` (adjust the session-scratchpad path to whatever is live in your session):

```js
// Quick manual check - not a committed test, this project has no test framework.
function roundToTwoDecimals(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function calculateContractBudget({ contractValue, assignments, contractorPayments }) {
  const totalAllocated = roundToTwoDecimals(assignments.reduce((s, a) => s + a.allocatedAmount, 0));
  const totalPaid = roundToTwoDecimals(contractorPayments.reduce((s, p) => s + p.amount, 0));
  const totalPending = roundToTwoDecimals(Math.max(totalAllocated - totalPaid, 0));
  const estimatedProfit = roundToTwoDecimals(contractValue - totalAllocated);
  const profitMarginPercent = contractValue === 0 ? 0 : roundToTwoDecimals((estimatedProfit / contractValue) * 100);
  return { totalAllocated, totalPaid, totalPending, estimatedProfit, profitMarginPercent };
}

const result = calculateContractBudget({
  contractValue: 70000,
  assignments: [{ allocatedAmount: 25000 }, { allocatedAmount: 15000 }],
  contractorPayments: [{ amount: 10000 }],
});
console.log(result);
// Expect: totalAllocated 40000, totalPaid 10000, totalPending 30000,
// estimatedProfit 30000, profitMarginPercent ~42.86
```

Run it with `node <path>.mjs`, confirm the numbers match the comment, then delete the script.

- [ ] **Step 4: Commit**

```bash
git add lib/contractCalculations.ts
git commit -m "Add contract budget/profit calculation helper"
```

---

### Task 3: Firestore read/write functions for Contractors and Contracts

**Files:**
- Modify: `lib/db.ts`

**Interfaces:**
- Consumes: `Contractor`, `Contract` types from Task 1; `adminDb`, `withTimeout`, `cache` (all already used identically for `clients`/`invoices` in this file).
- Produces: `getContractors(): Promise<Contractor[]>`, `saveContractor(contractor: Contractor): Promise<void>`, `deleteContractor(id: string): Promise<void>`, `getContracts(): Promise<Contract[]>`, `saveContract(contract: Contract): Promise<void>`, `deleteContract(id: string): Promise<void>`.

- [ ] **Step 1: Update the import line**

In `lib/db.ts`, find:

```ts
import { BusinessProfile, Client, Invoice, Counters, Expense } from "./types";
```

Change to:

```ts
import { BusinessProfile, Client, Invoice, Counters, Expense, Contractor, Contract } from "./types";
```

- [ ] **Step 2: Add Contractor and Contract CRUD functions**

Add this block after the existing `deleteExpense` function (end of the "Expense Operations" section, right before `// Authentication Password Hash Operations`):

```ts
// Contractor Operations
export const getContractors = cache(async (): Promise<Contractor[]> => {
  try {
    const querySnapshot = await withTimeout(adminDb.collection("contractors").get(), "read (contractors)");
    const list: Contractor[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Contractor));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error reading contractors from Firestore:", error);
    return [];
  }
});

export async function saveContractor(contractor: Contractor): Promise<void> {
  await withTimeout(adminDb.collection("contractors").doc(contractor.id).set(contractor), "write (contractors)");
}

export async function deleteContractor(id: string): Promise<void> {
  await withTimeout(adminDb.collection("contractors").doc(id).delete(), "delete (contractors)");
}

// Contract Operations
export const getContracts = cache(async (): Promise<Contract[]> => {
  try {
    const querySnapshot = await withTimeout(adminDb.collection("contracts").get(), "read (contracts)");
    const list: Contract[] = [];
    querySnapshot.forEach((d) => list.push(d.data() as Contract));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error reading contracts from Firestore:", error);
    return [];
  }
});

export async function saveContract(contract: Contract): Promise<void> {
  await withTimeout(adminDb.collection("contracts").doc(contract.id).set(contract), "write (contracts)");
}

export async function deleteContract(id: string): Promise<void> {
  await withTimeout(adminDb.collection("contracts").doc(id).delete(), "delete (contracts)");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Verify against real Firestore with a throwaway script**

Write and run a script (pattern: any existing `scratch-*.mjs` this session used for direct Firestore checks — read credentials from `.env.local` exactly as described in Global Constraints, `initializeApp({ credential: cert({...}) })` from `firebase-admin/app`, `getFirestore` from `firebase-admin/firestore`) that:
1. Writes a `Contractor` document with all required fields (`id` via `crypto.randomUUID()`, `bank: { bankName: "", accountName: "", accountNo: "", ifscOrSwift: "", branch: "" }`, `createdAt`/`updatedAt` as `new Date().toISOString()`).
2. Reads it back and confirms the fields round-trip.
3. Deletes it.

Expected: the script prints the written and read-back data matching, and cleanup succeeds.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "Add Firestore read/write functions for contractors and contracts"
```

---

### Task 4: Server Actions for Contractors

**Files:**
- Create: `app/contractActions.ts`

**Interfaces:**
- Consumes: `getContractors`, `saveContractor`, `deleteContractor` from `lib/db.ts` (Task 3); `Contractor`, `ContractorSchema` from `lib/types.ts` (Task 1).
- Produces: `createContractorAction(data: Omit<Contractor, "id" | "createdAt" | "updatedAt">): Promise<{ success: true; contractor: Contractor } | { success: false; error: string }>`, `updateContractorAction(id: string, data: Omit<Contractor, "id" | "createdAt" | "updatedAt">): Promise<same shape>`, `deleteContractorAction(id: string): Promise<{ success: true } | { success: false; error: string }>`.

- [ ] **Step 1: Write the Contractor actions**

Create `app/contractActions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { getContractors, saveContractor, deleteContractor } from "@/lib/db";
import { Contractor, ContractorSchema } from "@/lib/types";

// Next.js redacts thrown Server Action error messages in production builds,
// so every action here catches its own errors and returns { success, error }
// instead of throwing - same convention as app/actions.ts.
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

// --- Contractor Actions ---
export async function createContractorAction(data: Omit<Contractor, "id" | "createdAt" | "updatedAt">) {
  try {
    const id = uuidv4();
    const now = new Date().toISOString();
    const contractor: Contractor = { ...data, id, createdAt: now, updatedAt: now };
    const validated = ContractorSchema.parse(contractor);
    await saveContractor(validated);

    revalidatePath("/contractors");
    revalidatePath("/contracts/new");
    return { success: true as const, contractor: validated };
  } catch (error) {
    console.error("createContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to create contractor") };
  }
}

export async function updateContractorAction(id: string, data: Omit<Contractor, "id" | "createdAt" | "updatedAt">) {
  try {
    const contractors = await getContractors();
    const existing = contractors.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contractor not found" };
    }

    const contractor: Contractor = { ...data, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    const validated = ContractorSchema.parse(contractor);
    await saveContractor(validated);

    revalidatePath("/contractors");
    revalidatePath(`/contractors/${id}`);
    return { success: true as const, contractor: validated };
  } catch (error) {
    console.error("updateContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contractor") };
  }
}

export async function deleteContractorAction(id: string) {
  try {
    await deleteContractor(id);
    revalidatePath("/contractors");
    return { success: true as const };
  } catch (error) {
    console.error("deleteContractorAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to delete contractor") };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/contractActions.ts
git commit -m "Add contractor Server Actions"
```

---

### Task 5: Server Actions for Contracts (create, update, status, convert-from-quote, contractor payments)

**Files:**
- Modify: `app/contractActions.ts`

**Interfaces:**
- Consumes: `getContracts`, `saveContract`, `deleteContract` (Task 3); `getClients`, `getInvoices`, `saveInvoice`, `getBusinessProfile`, `getCounters`, `saveCounters` (all already exported from `lib/db.ts`); `Contract`, `ContractSchema`, `ContractAssignment`, `ContractMilestone`, `ContractorPayment`, `ContractorPaymentSchema`, `Client`, `Invoice` (from `lib/types.ts`).
- Produces: `createContractAction(data: ContractInput)`, `updateContractAction(id: string, data: ContractInput)`, `updateContractStatusAction(id: string, status: Contract["status"])`, `deleteContractAction(id: string)`, `convertQuoteToContractAction(quoteId: string)`, `recordContractorPaymentAction(contractId: string, data: { contractorId: string; amount: number; date: string; method: ContractorPayment["method"]; note?: string | null })`, `deleteContractorPaymentAction(contractId: string, paymentId: string)`.
- The `ContractInput` type (defined in this task) is what `components/ContractForm.tsx` (Task 7) will build and pass in.

- [ ] **Step 1: Add imports**

At the top of `app/contractActions.ts`, replace:

```ts
import { getContractors, saveContractor, deleteContractor } from "@/lib/db";
import { Contractor, ContractorSchema } from "@/lib/types";
```

with:

```ts
import {
  getContractors,
  saveContractor,
  deleteContractor,
  getContracts,
  saveContract,
  deleteContract,
  getClients,
  getBusinessProfile,
  getCounters,
  saveCounters,
} from "@/lib/db";
import { Contractor, ContractorSchema, Contract, ContractSchema, ContractorPayment, ContractorPaymentSchema, Client } from "@/lib/types";
import { v4 as uuidv4Contract } from "uuid";
```

(`uuidv4Contract` is an alias so this file has one `uuidv4` already imported for contractors — reuse the same `v4 as uuidv4` import instead of aliasing. Correction: just use the single existing `import { v4 as uuidv4 } from "uuid";` already present at the top of the file from Task 4 — delete the `uuidv4Contract` alias line above, there is no need for a second import.)

- [ ] **Step 2: Add contract numbering + client snapshot helpers**

Append after the Contractor actions block:

```ts
// --- Contract Actions ---
function buildContractClientSnapshot(client: Client) {
  return { name: client.name, companyName: client.companyName || null };
}

async function nextContractNumber(year: string) {
  const [profile, counters] = await Promise.all([getBusinessProfile(), getCounters()]);
  const nextSequence = (counters.contractCounters[year] || 0) + 1;
  counters.contractCounters[year] = nextSequence;
  await saveCounters(counters);

  const contractNo = `${profile.contractPrefix}-${year}-${String(nextSequence).padStart(3, "0")}`;
  return { contractNo, nextSequence };
}

interface ContractInput {
  projectName: string;
  clientId: string;
  contractType: Contract["contractType"];
  priority: Contract["priority"];
  startDate?: string | null;
  expectedCompletion?: string | null;
  contractValue: number;
  assignments: Array<{ contractorId: string; contractorName: string; role: string; allocatedAmount: number }>;
  milestones: Array<{ title: string; amount: number; dueDate?: string | null; status: Contract["milestones"][number]["status"]; notes?: string | null }>;
  repositoryLink?: string | null;
  deploymentUrl?: string | null;
  figmaLink?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
}
```

- [ ] **Step 3: Add `createContractAction` and `updateContractAction`**

```ts
export async function createContractAction(data: ContractInput) {
  try {
    const clients = await getClients();
    const client = clients.find((c) => c.id === data.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const year = String(new Date().getFullYear());
    const { contractNo, nextSequence } = await nextContractNumber(year);
    const now = new Date().toISOString();

    const contract: Contract = {
      id: uuidv4(),
      contractNo,
      year,
      sequence: nextSequence,
      projectName: data.projectName,
      clientId: data.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      sourceQuoteId: null,
      contractType: data.contractType,
      status: "draft",
      priority: data.priority,
      startDate: data.startDate || null,
      expectedCompletion: data.expectedCompletion || null,
      contractValue: data.contractValue,
      assignments: data.assignments.map((a) => ({ ...a })),
      milestones: data.milestones.map((m) => ({ id: uuidv4(), ...m, dueDate: m.dueDate || null, notes: m.notes || null })),
      contractorPayments: [],
      repositoryLink: data.repositoryLink || null,
      deploymentUrl: data.deploymentUrl || null,
      figmaLink: data.figmaLink || null,
      notes: data.notes || null,
      clientNotes: data.clientNotes || null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = ContractSchema.parse(contract);
    await saveContract(validated);

    revalidatePath("/contracts");
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("createContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to create contract") };
  }
}

export async function updateContractAction(id: string, data: ContractInput) {
  try {
    const [contracts, clients] = await Promise.all([getContracts(), getClients()]);
    const existing = contracts.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }
    const client = clients.find((c) => c.id === data.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const updated: Contract = {
      ...existing,
      projectName: data.projectName,
      clientId: data.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      contractType: data.contractType,
      priority: data.priority,
      startDate: data.startDate || null,
      expectedCompletion: data.expectedCompletion || null,
      contractValue: data.contractValue,
      assignments: data.assignments.map((a) => ({ ...a })),
      milestones: data.milestones.map((m, idx) => ({
        id: existing.milestones[idx]?.id || uuidv4(),
        ...m,
        dueDate: m.dueDate || null,
        notes: m.notes || null,
      })),
      repositoryLink: data.repositoryLink || null,
      deploymentUrl: data.deploymentUrl || null,
      figmaLink: data.figmaLink || null,
      notes: data.notes || null,
      clientNotes: data.clientNotes || null,
      updatedAt: new Date().toISOString(),
    };

    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("updateContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contract") };
  }
}
```

Note the milestone id-matching in `updateContractAction`: it reuses `existing.milestones[idx]?.id` by position. This is correct as long as `ContractForm.tsx` (Task 7) always submits milestones in the same order it received them plus any new ones appended at the end — same convention as how `InvoiceForm.tsx` handles line items (no per-row stable client id needed because the whole array round-trips positionally). Document this assumption in Task 7.

- [ ] **Step 4: Add `updateContractStatusAction` and `deleteContractAction`**

```ts
export async function updateContractStatusAction(id: string, status: Contract["status"]) {
  try {
    const contracts = await getContracts();
    const existing = contracts.find((c) => c.id === id);
    if (!existing) {
      return { success: false as const, error: "Contract not found" };
    }

    const updated: Contract = { ...existing, status, updatedAt: new Date().toISOString() };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("updateContractStatusAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to update contract status") };
  }
}

export async function deleteContractAction(id: string) {
  try {
    await deleteContract(id);
    revalidatePath("/contracts");
    return { success: true as const };
  } catch (error) {
    console.error("deleteContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to delete contract") };
  }
}
```

- [ ] **Step 5: Add `convertQuoteToContractAction`**

This needs `getInvoices` and `saveInvoice` (for stamping `convertedToContractId` back onto the source quote). Add them to the `lib/db` import added in Step 1:

```ts
  getBusinessProfile,
  getCounters,
  saveCounters,
  getInvoices,
  saveInvoice,
```

Then add the action:

```ts
export async function convertQuoteToContractAction(quoteId: string) {
  try {
    const invoices = await getInvoices();
    const quote = invoices.find((inv) => inv.id === quoteId);
    if (!quote) {
      return { success: false as const, error: "Quote not found" };
    }
    if (quote.type !== "quote") {
      return { success: false as const, error: "Document is not a quote" };
    }
    if (quote.status !== "accepted") {
      return { success: false as const, error: "Only accepted quotes can be converted to a contract" };
    }
    if (quote.convertedToContractId) {
      return { success: false as const, error: "This quote has already been converted to a contract" };
    }

    const clients = await getClients();
    const client = clients.find((c) => c.id === quote.clientId);
    if (!client) {
      return { success: false as const, error: "Client not found" };
    }

    const year = String(new Date().getFullYear());
    const { contractNo, nextSequence } = await nextContractNumber(year);
    const now = new Date().toISOString();

    const contract: Contract = {
      id: uuidv4(),
      contractNo,
      year,
      sequence: nextSequence,
      projectName: quote.invoiceNo,
      clientId: quote.clientId,
      clientSnapshot: buildContractClientSnapshot(client),
      sourceQuoteId: quote.id,
      contractType: "fixed",
      status: "draft",
      priority: "medium",
      startDate: null,
      expectedCompletion: null,
      contractValue: quote.grandTotal,
      assignments: [],
      milestones: [],
      contractorPayments: [],
      repositoryLink: null,
      deploymentUrl: null,
      figmaLink: null,
      notes: quote.notes || null,
      clientNotes: null,
      createdAt: now,
      updatedAt: now,
    };

    const validated = ContractSchema.parse(contract);
    await saveContract(validated);

    quote.convertedToContractId = validated.id;
    quote.updatedAt = new Date().toISOString();
    await saveInvoice(quote);

    revalidatePath("/contracts");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${quoteId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("convertQuoteToContractAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to convert quote to contract") };
  }
}
```

`projectName: quote.invoiceNo` is a placeholder-free default (Systemiq's actual quote number, e.g. "QUO-2026-0003") since quotes in this app don't have a separate "project name" field to inherit — the admin can rename it immediately after conversion via `updateContractAction`.

- [ ] **Step 6: Add contractor payment actions**

```ts
export async function recordContractorPaymentAction(
  contractId: string,
  data: { contractorId: string; amount: number; date: string; method: ContractorPayment["method"]; note?: string | null }
) {
  try {
    const [contracts, contractors] = await Promise.all([getContracts(), getContractors()]);
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      return { success: false as const, error: "Contract not found" };
    }
    const contractor = contractors.find((c) => c.id === data.contractorId);
    if (!contractor) {
      return { success: false as const, error: "Contractor not found" };
    }

    const payment: ContractorPayment = {
      id: uuidv4(),
      contractorId: data.contractorId,
      contractorName: contractor.name,
      amount: data.amount,
      date: data.date,
      method: data.method,
      note: data.note || null,
      createdAt: new Date().toISOString(),
    };
    const validatedPayment = ContractorPaymentSchema.parse(payment);

    const updated: Contract = {
      ...contract,
      contractorPayments: [...contract.contractorPayments, validatedPayment],
      updatedAt: new Date().toISOString(),
    };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath(`/contracts/${contractId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("recordContractorPaymentAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to record contractor payment") };
  }
}

export async function deleteContractorPaymentAction(contractId: string, paymentId: string) {
  try {
    const contracts = await getContracts();
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      return { success: false as const, error: "Contract not found" };
    }

    const updated: Contract = {
      ...contract,
      contractorPayments: contract.contractorPayments.filter((p) => p.id !== paymentId),
      updatedAt: new Date().toISOString(),
    };
    const validated = ContractSchema.parse(updated);
    await saveContract(validated);

    revalidatePath(`/contracts/${contractId}`);
    return { success: true as const, contract: validated };
  } catch (error) {
    console.error("deleteContractorPaymentAction failed:", error);
    return { success: false as const, error: errorMessage(error, "Failed to remove contractor payment") };
  }
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. If `ContractInput["milestones"][number]["status"]` doesn't resolve, replace it with the literal union `"pending" | "in_progress" | "completed" | "paid"` directly.

- [ ] **Step 8: Commit**

```bash
git add app/contractActions.ts
git commit -m "Add contract Server Actions: CRUD, status, quote conversion, contractor payments"
```

---

### Task 6: Contractors UI — dialog, list, and page

**Files:**
- Create: `components/ContractorDialog.tsx`
- Create: `components/ContractorsList.tsx`
- Create: `app/(app)/contractors/page.tsx`

**Interfaces:**
- Consumes: `createContractorAction`, `updateContractorAction`, `deleteContractorAction` from `app/contractActions.ts` (Task 4); `Contractor` type from `lib/types.ts`; `getContractors` from `lib/db.ts`; `Modal` from `components/Modal.tsx`.

- [ ] **Step 1: Write `components/ContractorDialog.tsx`**

Directly modeled on `components/ClientDialog.tsx` (same `Modal` usage, same submit/error pattern), with contractor-specific fields:

```tsx
"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { Contractor } from "@/lib/types";
import { createContractorAction, updateContractorAction } from "@/app/contractActions";
import { Loader2 } from "lucide-react";

interface ContractorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (contractor: Contractor) => void;
  contractor?: Contractor | null;
}

const PAYMENT_METHODS: { value: Contractor["preferredPaymentMethod"]; label: string }[] = [
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

export default function ContractorDialog({ isOpen, onClose, onSuccess, contractor }: ContractorDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [primaryRole, setPrimaryRole] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [sprintRate, setSprintRate] = useState("0");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<Contractor["preferredPaymentMethod"]>("bank");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscOrSwift, setIfscOrSwift] = useState("");
  const [branch, setBranch] = useState("");
  const [upiId, setUpiId] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [status, setStatus] = useState<Contractor["status"]>("active");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contractor) {
      setName(contractor.name);
      setEmail(contractor.email || "");
      setPhone(contractor.phone || "");
      setCollege(contractor.college || "");
      setSkillsInput(contractor.skills.join(", "));
      setPrimaryRole(contractor.primaryRole || "");
      setHourlyRate(String(contractor.hourlyRate));
      setSprintRate(String(contractor.sprintRate));
      setPreferredPaymentMethod(contractor.preferredPaymentMethod);
      setBankName(contractor.bank.bankName || "");
      setAccountName(contractor.bank.accountName || "");
      setAccountNo(contractor.bank.accountNo || "");
      setIfscOrSwift(contractor.bank.ifscOrSwift || "");
      setBranch(contractor.bank.branch || "");
      setUpiId(contractor.upiId || "");
      setPanNumber(contractor.panNumber || "");
      setStatus(contractor.status);
      setNotes(contractor.notes || "");
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setCollege("");
      setSkillsInput("");
      setPrimaryRole("");
      setHourlyRate("0");
      setSprintRate("0");
      setPreferredPaymentMethod("bank");
      setBankName("");
      setAccountName("");
      setAccountNo("");
      setIfscOrSwift("");
      setBranch("");
      setUpiId("");
      setPanNumber("");
      setStatus("active");
      setNotes("");
    }
    setErrors({});
  }, [contractor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = {
      name,
      email: email || null,
      phone: phone || null,
      college: college || null,
      skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
      primaryRole: primaryRole || null,
      hourlyRate: Number(hourlyRate) || 0,
      sprintRate: Number(sprintRate) || 0,
      preferredPaymentMethod,
      bank: { bankName, accountName, accountNo, ifscOrSwift, branch },
      upiId: upiId || null,
      panNumber: panNumber || null,
      status,
      notes: notes || null,
    };

    try {
      const result = contractor
        ? await updateContractorAction(contractor.id, payload)
        : await createContractorAction(payload);

      if (result.success) {
        if (onSuccess) onSuccess(result.contractor);
        onClose();
      } else {
        setErrors({ general: result.error });
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={contractor ? "Edit Contractor" : "Add New Contractor"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{errors.general}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Arjun Nair"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Primary Role</label>
            <input
              type="text"
              placeholder="e.g. Backend Developer"
              value={primaryRole}
              onChange={(e) => setPrimaryRole(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">College (Optional)</label>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Contractor["status"])}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="active">Active</option>
              <option value="busy">Busy</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Skills (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. React, Node.js, Figma"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hourly Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Sprint Rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sprintRate}
              onChange={(e) => setSprintRate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pay Via</label>
            <select
              value={preferredPaymentMethod}
              onChange={(e) => setPreferredPaymentMethod(e.target.value as Contractor["preferredPaymentMethod"])}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Holder</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Number</label>
            <input
              type="text"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">IFSC / SWIFT</label>
            <input
              type="text"
              value={ifscOrSwift}
              onChange={(e) => setIfscOrSwift(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">PAN (Optional)</label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-75 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {contractor ? "Save Changes" : "Add Contractor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Write `components/ContractorsList.tsx`**

Directly modeled on `components/ClientsList.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { Plus, Search, UserCog, Edit, Trash2, Mail, Phone, Info } from "lucide-react";
import { Contractor } from "@/lib/types";
import { deleteContractorAction } from "@/app/contractActions";
import { formatCurrency } from "@/lib/utils";
import ContractorDialog from "./ContractorDialog";

interface ContractorsListProps {
  initialContractors: Contractor[];
}

const STATUS_STYLES: Record<Contractor["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  busy: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-500",
};

export default function ContractorsList({ initialContractors }: ContractorsListProps) {
  const [contractors, setContractors] = useState<Contractor[]>(initialContractors);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);

  const filteredContractors = contractors.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.primaryRole && c.primaryRole.toLowerCase().includes(q)) ||
      c.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setEditingContractor(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (contractor: Contractor) => {
    setEditingContractor(contractor);
    setIsModalOpen(true);
  };

  const handleContractorSaved = (contractor: Contractor) => {
    setContractors((prev) => {
      const idx = prev.findIndex((c) => c.id === contractor.id);
      if (idx === -1) return [...prev, contractor].sort((a, b) => a.name.localeCompare(b.name));
      const next = [...prev];
      next[idx] = contractor;
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete contractor "${name}"? This will not delete contracts they were assigned to.`)) {
      const res = await deleteContractorAction(id);
      if (res.success) {
        setContractors((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(res.error || "Failed to delete contractor.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            Contractors
          </h1>
          <p className="hidden sm:block text-sm text-slate-500 mt-1">People who deliver work under Systemiq contracts.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Contractor
        </button>
      </div>

      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus-within:border-indigo-500 transition-colors">
        <Search className="h-5 w-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by name, role, or skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
        />
      </div>

      {filteredContractors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Info className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-500">No contractors found</p>
          <p className="text-xs mt-1">Add the people who deliver work under Systemiq contracts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContractors.map((contractor) => (
            <div key={contractor.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{contractor.name}</h3>
                  {contractor.primaryRole && <div className="text-xs text-slate-500 truncate">{contractor.primaryRole}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[contractor.status]}`}>
                    {contractor.status}
                  </span>
                  <button
                    onClick={() => handleOpenEditModal(contractor)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                    title="Edit Contractor"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contractor.id, contractor.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                    title="Delete Contractor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {contractor.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contractor.skills.map((skill) => (
                    <span key={skill} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-500">
                {contractor.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {contractor.email}
                  </div>
                )}
                {contractor.phone && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {contractor.phone}
                  </div>
                )}
                {contractor.hourlyRate > 0 && (
                  <div className="text-slate-700 font-semibold">{formatCurrency(contractor.hourlyRate, "INR")}/hr</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContractorDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contractor={editingContractor}
        onSuccess={handleContractorSaved}
      />
    </div>
  );
}
```

`formatCurrency(contractor.hourlyRate, "INR")` hardcodes `"INR"` rather than reading `profile.currency` — `ContractorsList` isn't passed a `BusinessProfile` prop in this plan (kept minimal, matching `ClientsList`, which also doesn't take one). If multi-currency ever matters here, thread `profile.currency` through from `app/(app)/contractors/page.tsx` the same way `app/(app)/invoices/page.tsx` does for `InvoicesList` — out of scope for Phase 1 since this business only bills in INR today (`BusinessProfileSchema.currency` defaults to `"INR"` and nothing in this app currently changes it).

- [ ] **Step 3: Write `app/(app)/contractors/page.tsx`**

```tsx
import React from "react";
import { getContractors } from "@/lib/db";
import ContractorsList from "@/components/ContractorsList";

export const revalidate = 0;

export default async function ContractorsPage() {
  const contractors = await getContractors();
  return <ContractorsList initialContractors={contractors} />;
}
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean. `/contractors` should appear in the build's route list.

- [ ] **Step 5: Verify with a throwaway Playwright script**

Following the Global Constraints auth pattern, drive `next start` (build first) against `http://localhost:<port>` (check for a free port first, per this project's established pattern of never assuming 3000 is free):
1. Navigate to `/contractors`.
2. Click "Add Contractor", fill Name + Primary Role + Hourly Rate, submit.
3. Assert the new contractor card renders with the name and role.
4. Click Edit, change the status to "busy", save, assert the status badge updates.
5. Click Delete, confirm, assert the card is gone.
6. Directly clean up via the Firestore Admin SDK in case any step left a stray document (belt-and-suspenders, per Global Constraints).

Expected: all assertions pass, no console/page errors.

- [ ] **Step 6: Commit**

```bash
git add components/ContractorDialog.tsx components/ContractorsList.tsx "app/(app)/contractors/page.tsx"
git commit -m "Add Contractors list, add/edit dialog, and page"
```

---

### Task 7: Contract create/edit form (project info, team assignment, milestones)

**Files:**
- Create: `components/ContractForm.tsx`
- Create: `app/(app)/contracts/new/page.tsx`

**Interfaces:**
- Consumes: `createContractAction`, `updateContractAction` from `app/contractActions.ts` (Task 5); `Contract`, `Contractor`, `Client` types; `getClients`, `getContractors` from `lib/db.ts`.
- Produces: nothing consumed by later tasks except the route `/contracts/new` and `/contracts/[id]` (edit mode, reusing this same component — see Task 8).

- [ ] **Step 1: Write `components/ContractForm.tsx`**

Modeled on `components/InvoiceForm.tsx`'s structure (client select + dynamic array editor + sticky summary sidebar), adapted for assignments and milestones instead of line items:

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, Loader2, ArrowLeft, Briefcase } from "lucide-react";
import { Client, Contractor, Contract } from "@/lib/types";
import { createContractAction, updateContractAction } from "@/app/contractActions";
import { formatCurrency, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";

interface ContractFormProps {
  clients: Client[];
  contractors: Contractor[];
  contract?: Contract | null;
  preselectedClientId?: string;
}

interface FormAssignment {
  id: string;
  contractorId: string;
  role: string;
  allocatedAmount: number;
}

interface FormMilestone {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: Contract["milestones"][number]["status"];
  notes: string;
}

export default function ContractForm({ clients, contractors, contract, preselectedClientId }: ContractFormProps) {
  const router = useRouter();
  const isEditMode = !!contract;

  const [projectName, setProjectName] = useState(contract?.projectName || "");
  const [clientId, setClientId] = useState(contract?.clientId || preselectedClientId || "");
  const [contractType, setContractType] = useState<Contract["contractType"]>(contract?.contractType || "fixed");
  const [priority, setPriority] = useState<Contract["priority"]>(contract?.priority || "medium");
  const [startDate, setStartDate] = useState(contract?.startDate?.split("T")[0] || "");
  const [expectedCompletion, setExpectedCompletion] = useState(contract?.expectedCompletion?.split("T")[0] || "");
  const [contractValue, setContractValue] = useState(String(contract?.contractValue ?? 0));
  const [repositoryLink, setRepositoryLink] = useState(contract?.repositoryLink || "");
  const [deploymentUrl, setDeploymentUrl] = useState(contract?.deploymentUrl || "");
  const [figmaLink, setFigmaLink] = useState(contract?.figmaLink || "");
  const [notes, setNotes] = useState(contract?.notes || "");
  const [clientNotes, setClientNotes] = useState(contract?.clientNotes || "");

  const [assignments, setAssignments] = useState<FormAssignment[]>(
    contract?.assignments.map((a, idx) => ({ id: String(idx), contractorId: a.contractorId, role: a.role, allocatedAmount: a.allocatedAmount })) || []
  );
  const [milestones, setMilestones] = useState<FormMilestone[]>(
    contract?.milestones.map((m) => ({ id: m.id, title: m.title, amount: m.amount, dueDate: m.dueDate?.split("T")[0] || "", status: m.status, notes: m.notes || "" })) || []
  );

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addAssignment = () => {
    setAssignments([...assignments, { id: "a_" + Math.random().toString(36).slice(2, 9), contractorId: "", role: "", allocatedAmount: 0 }]);
  };
  const updateAssignment = (id: string, fields: Partial<FormAssignment>) => {
    setAssignments(assignments.map((a) => (a.id === id ? { ...a, ...fields } : a)));
  };
  const removeAssignment = (id: string) => setAssignments(assignments.filter((a) => a.id !== id));

  const addMilestone = () => {
    setMilestones([...milestones, { id: "m_" + Math.random().toString(36).slice(2, 9), title: "", amount: 0, dueDate: "", status: "pending", notes: "" }]);
  };
  const updateMilestone = (id: string, fields: Partial<FormMilestone>) => {
    setMilestones(milestones.map((m) => (m.id === id ? { ...m, ...fields } : m)));
  };
  const removeMilestone = (id: string) => setMilestones(milestones.filter((m) => m.id !== id));

  const budget = calculateContractBudget({
    contractValue: Number(contractValue) || 0,
    assignments: assignments.filter((a) => a.contractorId).map((a) => ({ contractorId: a.contractorId, contractorName: "", role: a.role, allocatedAmount: a.allocatedAmount })),
    contractorPayments: contract?.contractorPayments || [],
  });

  const handleSave = async () => {
    if (!projectName.trim()) {
      setErrors({ projectName: "Project name is required" });
      return;
    }
    if (!clientId) {
      setErrors({ clientId: "Please select a client" });
      return;
    }
    const validAssignments = assignments.filter((a) => a.contractorId && a.role.trim());
    for (const a of validAssignments) {
      const contractor = contractors.find((c) => c.id === a.contractorId);
      if (!contractor) continue;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      projectName,
      clientId,
      contractType,
      priority,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      expectedCompletion: expectedCompletion ? new Date(expectedCompletion).toISOString() : null,
      contractValue: Number(contractValue) || 0,
      assignments: validAssignments.map((a) => ({
        contractorId: a.contractorId,
        contractorName: contractors.find((c) => c.id === a.contractorId)?.name || "",
        role: a.role,
        allocatedAmount: Number(a.allocatedAmount) || 0,
      })),
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m) => ({
          title: m.title,
          amount: Number(m.amount) || 0,
          dueDate: m.dueDate ? new Date(m.dueDate).toISOString() : null,
          status: m.status,
          notes: m.notes || null,
        })),
      repositoryLink: repositoryLink || null,
      deploymentUrl: deploymentUrl || null,
      figmaLink: figmaLink || null,
      notes: notes || null,
      clientNotes: clientNotes || null,
    };

    try {
      const result = isEditMode && contract ? await updateContractAction(contract.id, payload) : await createContractAction(payload);
      if (result.success) {
        router.push(`/contracts/${result.contract.id}`);
      } else {
        setErrors({ general: result.error });
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Failed to save contract" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-5">
        <button onClick={() => router.back()} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            {isEditMode ? `Edit Contract - ${contract.contractNo}` : "New Contract"}
          </h1>
        </div>
      </div>

      {errors.general && <div className="p-4 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl">{errors.general}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Project Details</h2>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Project Name *</label>
              <input
                type="text"
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 focus:border-indigo-500 focus:outline-none",
                  errors.projectName ? "border-rose-400" : "border-slate-200"
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none",
                    errors.clientId ? "border-rose-400" : "border-slate-200"
                  )}
                >
                  <option value="">-- Choose client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.companyName ? ` (${c.companyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contract Value (INR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as Contract["contractType"])}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="fixed">Fixed Price</option>
                  <option value="milestone">Milestone</option>
                  <option value="hourly">Hourly</option>
                  <option value="retainer">Retainer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Contract["priority"])}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expected Completion</label>
                <input
                  type="date"
                  value={expectedCompletion}
                  onChange={(e) => setExpectedCompletion(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Repository Link</label>
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={repositoryLink}
                  onChange={(e) => setRepositoryLink(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Deployment URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Figma Link</label>
                <input
                  type="text"
                  placeholder="https://figma.com/..."
                  value={figmaLink}
                  onChange={(e) => setFigmaLink(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-base font-bold text-slate-800">Team Assignment</h2>
              <button
                type="button"
                onClick={addAssignment}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Assign Contractor
              </button>
            </div>

            {assignments.length === 0 && <p className="text-xs text-slate-400 italic">No contractors assigned yet.</p>}

            {assignments.map((a) => (
              <div key={a.id} className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-3 items-end p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contractor</label>
                  <select
                    value={a.contractorId}
                    onChange={(e) => updateAssignment(a.id, { contractorId: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose --</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role on This Contract</label>
                  <input
                    type="text"
                    placeholder="e.g. Backend Developer"
                    value={a.role}
                    onChange={(e) => updateAssignment(a.id, { role: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Allocated (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={a.allocatedAmount}
                    onChange={(e) => updateAssignment(a.id, { allocatedAmount: Number(e.target.value) || 0 })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <button type="button" onClick={() => removeAssignment(a.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-base font-bold text-slate-800">Milestones</h2>
              <button
                type="button"
                onClick={addMilestone}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Milestone
              </button>
            </div>

            {milestones.length === 0 && <p className="text-xs text-slate-400 italic">No milestones yet.</p>}

            {milestones.map((m) => (
              <div key={m.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. UI Design"
                    value={m.title}
                    onChange={(e) => updateMilestone(m.id, { title: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.amount}
                    onChange={(e) => updateMilestone(m.id, { amount: Number(e.target.value) || 0 })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                  <input
                    type="date"
                    value={m.dueDate}
                    onChange={(e) => updateMilestone(m.id, { dueDate: e.target.value })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={m.status}
                    onChange={(e) => updateMilestone(m.id, { status: e.target.value as FormMilestone["status"] })}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeMilestone(m.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">Notes</h2>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Internal Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Client-Visible Notes</label>
              <textarea rows={2} value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-5 lg:sticky lg:top-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3">Budget Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Contract Value:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(Number(contractValue) || 0, "INR")}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Allocated to Team:</span>
                <span className="font-semibold text-rose-400">-{formatCurrency(budget.totalAllocated, "INR")}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-4 mt-2">
                <span className="text-base font-bold text-slate-200">Estimated Profit:</span>
                <span className={cn("text-2xl font-black tracking-tight", budget.estimatedProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {formatCurrency(budget.estimatedProfit, "INR")}
                </span>
              </div>
              <div className="text-xs text-slate-500">{budget.profitMarginPercent.toFixed(1)}% margin</div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {isEditMode ? "Save Changes" : "Create Contract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note on milestone id round-tripping (referenced in Task 5, Step 3): `FormMilestone.id` for existing milestones is the real Firestore-assigned `m.id`; for new ones added via `addMilestone()` it's a client-only placeholder (`"m_" + random`). The submitted payload strips `id` entirely (`.map((m) => ({ title, amount, dueDate, status, notes }))` — no `id` field), so `updateContractAction` always re-derives ids positionally from `existing.milestones[idx]?.id`, falling back to a fresh `uuidv4()` for anything past the existing array's length (i.e. newly-added milestones). This matches the exact behavior already relied on for invoice line items (`components/InvoiceForm.tsx`'s `FormLineItem.id` is client-only and never sent to the server either — only `slNo`, derived positionally by `calculateLineItem(item, index + 1)` in `app/actions.ts`).

- [ ] **Step 2: Write `app/(app)/contracts/new/page.tsx`**

```tsx
import React from "react";
import { getClients, getContractors } from "@/lib/db";
import ContractForm from "@/components/ContractForm";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewContractPage({ searchParams }: PageProps) {
  const [{ clientId }, clients, contractors] = await Promise.all([searchParams, getClients(), getContractors()]);
  return <ContractForm clients={clients} contractors={contractors} preselectedClientId={clientId} />;
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean, `/contracts/new` appears in the route list.

- [ ] **Step 4: Verify with a throwaway Playwright script**

1. Ensure at least one Client and one Contractor exist (create via the real actions if not — clean up afterward).
2. Navigate to `/contracts/new`.
3. Fill Project Name, select Client, set Contract Value to `50000`.
4. Click "Assign Contractor", select the contractor, set Allocated to `20000`.
5. Assert the sidebar shows Estimated Profit = ₹30,000.00 and margin 60.0%.
6. Click "Add Milestone", fill a title and amount.
7. Submit, assert redirect to `/contracts/<new-id>` (this will 404 until Task 8 — for this task, it's enough to assert the URL matches `/contracts/[uuid]` and that `createContractAction` returned `success: true`, which you can confirm by reading the new Firestore document directly with the Admin SDK).
8. Delete the test contract, client, and contractor via the Admin SDK.

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add components/ContractForm.tsx "app/(app)/contracts/new/page.tsx"
git commit -m "Add contract create/edit form with team assignment and milestones"
```

---

### Task 8: Contract detail view (status lifecycle, team, milestones, budget, contractor payments)

**Files:**
- Create: `components/ContractDetailView.tsx`
- Create: `app/(app)/contracts/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateContractStatusAction`, `recordContractorPaymentAction`, `deleteContractorPaymentAction`, `deleteContractAction` from `app/contractActions.ts` (Task 5); `ContractForm` (Task 7, reused here for the edit-mode branch, same as `InvoiceDetailView.tsx` embeds `InvoiceForm` for its edit mode); `calculateContractBudget` from `lib/contractCalculations.ts` (Task 2); `getContracts`, `getClients`, `getContractors` from `lib/db.ts`.

- [ ] **Step 1: Write `components/ContractDetailView.tsx`**

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  ExternalLink,
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
} from "lucide-react";
import { Contract, Client, Contractor } from "@/lib/types";
import { updateContractStatusAction, deleteContractAction, recordContractorPaymentAction, deleteContractorPaymentAction, deleteContractorAction as _unused } from "@/app/contractActions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";
import ContractForm from "./ContractForm";
import Modal from "./Modal";

interface ContractDetailViewProps {
  contract: Contract;
  client: Client | undefined;
  clients: Client[];
  contractors: Contractor[];
}

const STATUS_STYLES: Record<Contract["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-50 text-sky-700",
  in_progress: "bg-amber-50 text-amber-700",
  delivered: "bg-indigo-50 text-indigo-700",
  completed: "bg-emerald-50 text-emerald-700",
  paused: "bg-slate-200 text-slate-600",
  cancelled: "bg-rose-50 text-rose-700",
};

const STATUS_FLOW: Contract["status"][] = ["draft", "assigned", "in_progress", "delivered", "completed"];

const PAYMENT_METHODS: { value: NonNullable<Parameters<typeof recordContractorPaymentAction>[1]>["method"]; label: string }[] = [
  { value: "bank", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
];

export default function ContractDetailView({ contract: initialContract, client, clients, contractors }: ContractDetailViewProps) {
  const router = useRouter();
  const [contract, setContract] = useState<Contract>(initialContract);
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    contractorId: contract.assignments[0]?.contractorId || "",
    amount: "",
    date: new Date().toISOString().substring(0, 10),
    method: "bank" as "bank" | "upi" | "cash" | "paypal" | "other" | "card",
    note: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const budget = calculateContractBudget(contract);
  const currentStatusIndex = STATUS_FLOW.indexOf(contract.status);

  const handleStatusChange = async (status: Contract["status"]) => {
    setStatusLoading(true);
    try {
      const res = await updateContractStatusAction(contract.id, status);
      if (res.success) {
        setContract((prev) => ({ ...prev, status }));
      } else {
        alert(res.error || "Failed to update status");
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete contract "${contract.contractNo}"? This cannot be undone.`)) {
      const res = await deleteContractAction(contract.id);
      if (res.success) {
        router.push("/contracts");
      } else {
        alert(res.error || "Failed to delete contract");
      }
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError("");
    const amount = parseFloat(paymentForm.amount);
    if (!paymentForm.contractorId) {
      setPaymentError("Select a contractor");
      return;
    }
    if (!amount || amount <= 0) {
      setPaymentError("Enter a valid amount");
      return;
    }
    setPaymentSubmitting(true);
    try {
      const res = await recordContractorPaymentAction(contract.id, {
        contractorId: paymentForm.contractorId,
        amount,
        date: paymentForm.date,
        method: paymentForm.method,
        note: paymentForm.note || null,
      });
      if (res.success) {
        setContract(res.contract);
        setIsPaymentModalOpen(false);
        setPaymentForm({ contractorId: contract.assignments[0]?.contractorId || "", amount: "", date: new Date().toISOString().substring(0, 10), method: "bank", note: "" });
      } else {
        setPaymentError(res.error || "Failed to record payment");
      }
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Remove this contractor payment?")) return;
    const res = await deleteContractorPaymentAction(contract.id, paymentId);
    if (res.success) {
      setContract(res.contract);
    } else {
      alert(res.error || "Failed to remove payment");
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <span className="text-sm font-semibold text-slate-500">Editing Mode</span>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
        <ContractForm clients={clients} contractors={contractors} contract={contract} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push("/contracts")} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-mono text-sm font-bold text-slate-500">Contract</span>
          </div>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider", STATUS_STYLES[contract.status])}>
            {contract.status.replace("_", " ")}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{contract.projectName}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {contract.contractNo} &bull; {contract.clientSnapshot.name}
              {contract.clientSnapshot.companyName ? ` (${contract.clientSnapshot.companyName})` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 sm:hidden">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleDelete} className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold px-3 py-2 rounded-xl text-sm transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors"
              >
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleDelete} className="inline-flex items-center justify-center gap-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 overflow-x-auto no-scrollbar w-full sm:w-fit">
          {STATUS_FLOW.map((s, idx) => (
            <button
              key={s}
              disabled={statusLoading}
              onClick={() => handleStatusChange(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1",
                contract.status === s ? "bg-indigo-600 text-white" : idx < currentStatusIndex ? "text-emerald-600" : "text-slate-500 hover:bg-slate-100",
                statusLoading && "opacity-50"
              )}
            >
              {idx < currentStatusIndex && <CheckCircle className="h-3 w-3" />}
              {s.replace("_", " ")}
            </button>
          ))}
          <button
            disabled={statusLoading || contract.status === "paused"}
            onClick={() => handleStatusChange("paused")}
            className={cn("px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1", contract.status === "paused" ? "bg-slate-300 text-slate-800" : "text-slate-400 hover:bg-slate-100")}
          >
            <Pause className="h-3 w-3" /> Paused
          </button>
          <button
            disabled={statusLoading || contract.status === "cancelled"}
            onClick={() => handleStatusChange("cancelled")}
            className={cn("px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1", contract.status === "cancelled" ? "bg-rose-100 text-rose-700" : "text-slate-400 hover:bg-slate-100")}
          >
            <XCircle className="h-3 w-3" /> Cancelled
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" /> Team
            </h2>
            {contract.assignments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contractors assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.assignments.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{a.contractorName}</div>
                      <div className="text-xs text-slate-500">{a.role}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{formatCurrency(a.allocatedAmount, "INR")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">Milestones</h2>
            {contract.milestones.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No milestones yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{m.title}</div>
                      {m.dueDate && <div className="text-xs text-slate-500">Due {formatDate(m.dueDate)}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", m.status === "paid" ? "bg-emerald-50 text-emerald-700" : m.status === "completed" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                        {m.status.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">{formatCurrency(m.amount, "INR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(contract.repositoryLink || contract.deploymentUrl || contract.figmaLink) && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Links</h2>
              {contract.repositoryLink && (
                <a href={contract.repositoryLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Repository
                </a>
              )}
              {contract.deploymentUrl && (
                <a href={contract.deploymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Deployment
                </a>
              )}
              {contract.figmaLink && (
                <a href={contract.figmaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                  <ExternalLink className="h-3.5 w-3.5" /> Figma
                </a>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Contractor Payments</h2>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Record Payment
              </button>
            </div>
            {contract.contractorPayments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contractor payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {contract.contractorPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(p.amount, "INR")}</div>
                      <div className="text-xs text-slate-500">
                        {p.contractorName} &bull; {formatDate(p.date)} &bull; {p.method}
                      </div>
                    </div>
                    <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-4 lg:sticky lg:top-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Budget
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Contract Value:</span>
                <span className="font-semibold text-slate-200">{formatCurrency(contract.contractValue, "INR")}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Allocated:</span>
                <span className="font-semibold text-rose-400">-{formatCurrency(budget.totalAllocated, "INR")}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-3">
                <span className="font-bold text-slate-200">Est. Profit:</span>
                <span className={cn("text-xl font-black", budget.estimatedProfit >= 0 ? "text-emerald-400" : "text-rose-400")}>{formatCurrency(budget.estimatedProfit, "INR")}</span>
              </div>
              <div className="text-xs text-slate-500">{budget.profitMarginPercent.toFixed(1)}% margin</div>
              <div className="border-t border-slate-800 pt-3 flex justify-between text-slate-400">
                <span>Paid to Team:</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(budget.totalPaid, "INR")}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Pending Payout:</span>
                <span className="font-semibold text-amber-400">{formatCurrency(budget.totalPending, "INR")}</span>
              </div>
            </div>
          </div>

          {client && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-2">Client</h2>
              <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {client.name}
              </Link>
              {contract.sourceQuoteId && (
                <Link href={`/invoices/${contract.sourceQuoteId}`} className="block mt-2 text-xs text-slate-500 hover:text-indigo-600">
                  View source quote &rarr;
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Contractor Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">{paymentError}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contractor *</label>
            <select
              value={paymentForm.contractorId}
              onChange={(e) => setPaymentForm((f) => ({ ...f, contractorId: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose --</option>
              {contract.assignments.map((a) => (
                <option key={a.contractorId} value={a.contractorId}>
                  {a.contractorName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Amount *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date *</label>
              <input
                type="date"
                required
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Method</label>
            <select
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as typeof f.method }))}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={paymentSubmitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-75 transition-colors">
              Record Payment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

Fix before Step 2: the import line pulls in `deleteContractorAction as _unused`, which is dead weight left over from drafting — remove it. The import line should read:

```ts
import { updateContractStatusAction, deleteContractAction, recordContractorPaymentAction, deleteContractorPaymentAction } from "@/app/contractActions";
```

- [ ] **Step 2: Write `app/(app)/contracts/[id]/page.tsx`**

```tsx
import React from "react";
import { notFound } from "next/navigation";
import { getContracts, getClients, getContractors } from "@/lib/db";
import ContractDetailView from "@/components/ContractDetailView";

export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: PageProps) {
  const [{ id }, contracts, clients, contractors] = await Promise.all([params, getContracts(), getClients(), getContractors()]);
  const contract = contracts.find((c) => c.id === id);

  if (!contract) {
    notFound();
  }

  const client = clients.find((c) => c.id === contract.clientId);

  return <ContractDetailView contract={contract} client={client} clients={clients} contractors={contractors} />;
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean.

- [ ] **Step 4: Verify with a throwaway Playwright script**

1. Create a Client, a Contractor, and a Contract (with that contractor assigned, `allocatedAmount: 20000`, `contractValue: 50000`) directly via the real actions or Admin SDK.
2. Navigate to `/contracts/<id>`.
3. Assert the page shows the project name, contract number, assigned contractor + role, and Estimated Profit ₹30,000.00.
4. Click through the status buttons (assigned → in_progress → delivered → completed), asserting the active pill updates each time and completed statuses before the current one show a checkmark.
5. Click "Record Payment", fill amount `10000`, submit; assert "Paid to Team" shows ₹10,000.00 and "Pending Payout" shows ₹10,000.00 (20000 allocated - 10000 paid).
6. Delete the payment, assert both figures return to ₹0.00 / ₹20,000.00.
7. Click Edit, change the project name, save, assert the new name renders.
8. Delete the contract, assert redirect to `/contracts`.
9. Clean up the client and contractor via the Admin SDK.

Expected: every assertion passes, no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/ContractDetailView.tsx "app/(app)/contracts/[id]/page.tsx"
git commit -m "Add contract detail view: status lifecycle, team, milestones, contractor payments, budget"
```

---

### Task 9: Contracts list page

**Files:**
- Create: `components/ContractsList.tsx`
- Create: `app/(app)/contracts/page.tsx`

**Interfaces:**
- Consumes: `Contract` type; `getContracts` from `lib/db.ts`.

- [ ] **Step 1: Write `components/ContractsList.tsx`**

Modeled on `components/InvoicesList.tsx`'s mobile-card/desktop-table split (using the `xl:` breakpoint per Global Constraints), simplified (no filter-collapse needed yet — Phase 1 has few enough fields that a simple status filter fits without crowding):

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Search, Briefcase } from "lucide-react";
import { Contract } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateContractBudget } from "@/lib/contractCalculations";

interface ContractsListProps {
  initialContracts: Contract[];
}

const STATUS_STYLES: Record<Contract["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-50 text-sky-700",
  in_progress: "bg-amber-50 text-amber-700",
  delivered: "bg-indigo-50 text-indigo-700",
  completed: "bg-emerald-50 text-emerald-700",
  paused: "bg-slate-200 text-slate-600",
  cancelled: "bg-rose-50 text-rose-700",
};

export default function ContractsList({ initialContracts }: ContractsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | Contract["status"]>("all");

  const filtered = initialContracts.filter((c) => {
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
    const q = searchQuery.toLowerCase();
    return c.projectName.toLowerCase().includes(q) || c.contractNo.toLowerCase().includes(q) || c.clientSnapshot.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            Contracts
          </h1>
          <p className="hidden sm:block text-sm text-slate-500 mt-1">Delivery contracts for accepted work.</p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus-within:border-indigo-500 transition-colors">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by project, contract no., or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
          className="w-full sm:w-56 text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Briefcase className="h-8 w-8 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-500">No contracts found</p>
          <p className="text-xs mt-1">Convert an accepted quote, or create a contract directly.</p>
        </div>
      ) : (
        <>
          <div className="hidden xl:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5">Contract No.</th>
                    <th className="py-3.5 px-5">Project</th>
                    <th className="py-3.5 px-5">Client</th>
                    <th className="py-3.5 px-5 text-right">Value</th>
                    <th className="py-3.5 px-5 text-right">Est. Profit</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const budget = calculateContractBudget(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-mono font-bold text-slate-900">
                          <Link href={`/contracts/${c.id}`} className="hover:text-indigo-600">
                            {c.contractNo}
                          </Link>
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-800">{c.projectName}</td>
                        <td className="py-4 px-5">{c.clientSnapshot.name}</td>
                        <td className="py-4 px-5 text-right font-semibold">{formatCurrency(c.contractValue, "INR")}</td>
                        <td className={cn("py-4 px-5 text-right font-semibold", budget.estimatedProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {formatCurrency(budget.estimatedProfit, "INR")}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider", STATUS_STYLES[c.status])}>
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const budget = calculateContractBudget(c);
              return (
                <Link key={c.id} href={`/contracts/${c.id}`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-slate-900 text-sm">{c.contractNo}</span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_STYLES[c.status])}>{c.status.replace("_", " ")}</span>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{c.projectName}</div>
                    <div className="text-xs text-slate-500">{c.clientSnapshot.name}</div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                    <span className="text-slate-400">Value: {formatCurrency(c.contractValue, "INR")}</span>
                    <span className={cn("font-bold", budget.estimatedProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(budget.estimatedProfit, "INR")}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(app)/contracts/page.tsx`**

```tsx
import React from "react";
import { getContracts } from "@/lib/db";
import ContractsList from "@/components/ContractsList";

export const revalidate = 0;

export default async function ContractsPage() {
  const contracts = await getContracts();
  return <ContractsList initialContracts={contracts} />;
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean, `/contracts` appears in the route list.

- [ ] **Step 4: Verify with a throwaway Playwright script**

1. Create two test contracts with different statuses via the Admin SDK.
2. Navigate to `/contracts` at a mobile viewport (390px) — assert both render as cards, no horizontal overflow (check `document.documentElement.scrollWidth <= 390`).
3. Navigate at a desktop viewport (1440px) — assert the table renders instead.
4. Use the status filter dropdown, assert only matching contracts show.
5. Clean up the two test contracts.

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add components/ContractsList.tsx "app/(app)/contracts/page.tsx"
git commit -m "Add contracts list page with mobile card / desktop table layout"
```

---

### Task 10: Wire "Convert to Contract" into the quote detail view

**Files:**
- Modify: `components/InvoiceDetailView.tsx`

**Interfaces:**
- Consumes: `convertQuoteToContractAction` from `app/contractActions.ts` (Task 5).

- [ ] **Step 1: Add the import**

In `components/InvoiceDetailView.tsx`, find the existing action imports block (starts `import { updateInvoiceStatusAction, ...`) and add a new import line right after it:

```ts
import { convertQuoteToContractAction } from "@/app/contractActions";
```

- [ ] **Step 2: Add state and handler**

Near the other `use State` handlers (next to `handleConvertToInvoice`), add:

```ts
const [convertingToContract, setConvertingToContract] = useState(false);

const handleConvertToContract = async () => {
  if (!confirm("Create an internal delivery contract from this accepted quote?")) return;
  setConvertingToContract(true);
  try {
    const res = await convertQuoteToContractAction(invoice.id);
    if (res.success) {
      router.push(`/contracts/${res.contract.id}`);
    } else {
      alert(res.error || "Failed to convert quote to contract");
    }
  } finally {
    setConvertingToContract(false);
  }
};
```

- [ ] **Step 3: Add the button**

In the mobile actions row (`<div className="flex items-center gap-2 sm:hidden">`, added in the earlier mobile-menu fix), find the existing "Convert" button:

```tsx
{isQuote && invoice.status !== "declined" && !invoice.convertedToInvoiceId && (
  <button
    disabled={statusLoading}
    onClick={handleConvertToInvoice}
    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/10 cursor-pointer"
  >
    <ArrowRightCircle className="h-4 w-4" />
    Convert
  </button>
)}
```

Add right after it (still inside the mobile row div):

```tsx
{isQuote && invoice.status === "accepted" && !invoice.convertedToContractId && (
  <button
    disabled={convertingToContract}
    onClick={handleConvertToContract}
    className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold px-3 py-2 rounded-xl text-sm transition-colors"
    title="Convert to Contract"
  >
    <Briefcase className="h-4 w-4" />
  </button>
)}
```

Then find the matching desktop "Convert to Invoice" button inside `<div className="hidden sm:contents">` and add the equivalent full-width desktop version right after it:

```tsx
{isQuote && invoice.status === "accepted" && !invoice.convertedToContractId && (
  <button
    disabled={convertingToContract}
    onClick={handleConvertToContract}
    className="inline-flex items-center justify-center gap-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
  >
    <Briefcase className="h-4 w-4" />
    Convert to Contract
  </button>
)}
```

If `convertedToContractId` already exists on this quote, add a status banner near the existing `convertedToInvoiceId` banner (find `{invoice.convertedToInvoiceId && (` block) — add a sibling block right after it:

```tsx
{invoice.convertedToContractId && (
  <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-semibold rounded-xl flex items-center gap-2">
    <CheckCircle className="h-4 w-4 shrink-0" />
    This quote was converted to an internal contract.{" "}
    <Link href={`/contracts/${invoice.convertedToContractId}`} className="underline font-bold">
      View the contract
    </Link>
  </div>
)}
```

- [ ] **Step 4: Add the `Briefcase` icon import**

`components/InvoiceDetailView.tsx` already imports several `lucide-react` icons on one multi-line import. Add `Briefcase` to that list (it isn't imported yet — confirm with `grep -n "Briefcase" components/InvoiceDetailView.tsx` before editing; if it's absent, add it alongside `MoreHorizontal`).

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean.

- [ ] **Step 6: Verify with a throwaway Playwright script**

1. Create a quote via the real UI/actions, mark it `accepted` (via `updateInvoiceStatusAction`, already exists).
2. Navigate to that quote's detail page.
3. Assert the "Convert to Contract" button is visible (desktop viewport) and the icon-only version is visible (mobile viewport, 390px) — reuse the exact narrow-viewport check from the earlier "More menu" fix (widths 320/360/375/390) to confirm this new button doesn't reintroduce the same off-screen problem, since it now sits in the same non-wrapping mobile row.
4. Click it, confirm the dialog, assert redirect to `/contracts/<id>`.
5. Navigate back to the quote, assert the "converted to an internal contract" banner now shows with a working link.
6. Clean up the test quote and contract via the Admin SDK.

Expected: all assertions pass.

- [ ] **Step 7: Commit**

```bash
git add components/InvoiceDetailView.tsx
git commit -m "Add 'Convert to Contract' action to accepted quotes"
```

---

### Task 11: Navigation — add Contractors and Contracts to the sidebar/drawer

**Files:**
- Modify: `components/Navbar.tsx`

**Interfaces:**
- None consumed beyond routes already created in Tasks 6 and 9 (`/contractors`, `/contracts`).

- [ ] **Step 1: Add icons to the import**

In `components/Navbar.tsx`, find:

```ts
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Menu,
  X,
  Keyboard,
  Settings,
  Receipt,
  LogOut,
} from "lucide-react";
```

Change to:

```ts
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Menu,
  X,
  Keyboard,
  Settings,
  Receipt,
  LogOut,
  Briefcase,
  UserCog,
} from "lucide-react";
```

- [ ] **Step 2: Add nav items**

Find `NAV_ITEMS` (currently lines 21-27):

```ts
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileSpreadsheet },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

Change to:

```ts
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileSpreadsheet },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/contracts", label: "Contracts", icon: Briefcase },
  { href: "/contractors", label: "Contractors", icon: UserCog },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

This single array drives both the desktop sidebar and the mobile drawer (both `.map(NAV_ITEMS...)` blocks already read from it) — the mobile bottom bar's three icons (Dashboard/Invoices/Clients) are separate hardcoded `<Link>` elements and are intentionally left unchanged, matching how `Expenses` and `Settings` already work today (accessible via the drawer's "Menu" button, not the bottom bar).

- [ ] **Step 3: Extend keyboard shortcuts (optional but matches existing convention)**

In the `handleKeyDown` function inside `Navbar.tsx`, find the numbered shortcuts block (currently handles `"1"` through `"5"`) and add two more branches before the `key === "n"` branch:

```ts
        } else if (key === "6") {
          e.preventDefault();
          router.push("/contracts");
        } else if (key === "7") {
          e.preventDefault();
          router.push("/contractors");
        } else if (key === "n") {
```

Then in the Keyboard Shortcuts help modal JSX (the `<div className="space-y-3 py-1 text-xs">` block), add two rows after the "Go to Settings" row and before the "Create New Invoice" row:

```tsx
<div className="flex justify-between items-center">
  <span>Go to Contracts</span>
  <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 6</kbd>
</div>
<div className="flex justify-between items-center">
  <span>Go to Contractors</span>
  <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 7</kbd>
</div>
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json`, then `npm run build`.
Expected: both clean.

- [ ] **Step 5: Verify with a throwaway Playwright script**

1. Load any page at desktop width, assert the sidebar shows "Contracts" and "Contractors" links that navigate correctly.
2. Load at mobile width, open the drawer (tap "Menu" in the bottom bar), assert the same two links appear there.
3. Press Alt+Shift+6, assert navigation to `/contracts`; press Alt+Shift+7, assert navigation to `/contractors`.

Expected: all assertions pass.

- [ ] **Step 6: Commit**

```bash
git add components/Navbar.tsx
git commit -m "Add Contracts and Contractors to navigation and keyboard shortcuts"
```

---

### Task 12: Full end-to-end verification and deploy

**Files:** none (verification only).

- [ ] **Step 1: Full clean build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run build
```

Expected: both clean, and the build's route list includes `/contractors`, `/contracts`, `/contracts/new`, `/contracts/[id]`.

- [ ] **Step 2: End-to-end Playwright walkthrough against a local production build**

Start the built app (`npx next start -p <free-port>`, checking first that the port is actually free — this project has repeatedly hit stale-process port conflicts). Using the session-cookie auth pattern from Global Constraints, script the full lifecycle in one pass:

1. Create a Contractor.
2. Create a Client and an accepted Quote for that client (reuse existing invoice creation + `updateInvoiceStatusAction(id, "accepted")`).
3. From the quote detail page, click "Convert to Contract".
4. On the resulting contract, assign the contractor with an allocated amount, add two milestones, save.
5. Walk the status through assigned → in_progress → delivered → completed.
6. Record a contractor payment smaller than the allocated amount; assert the budget panel's numbers are internally consistent (`totalPaid + totalPending === totalAllocated`).
7. Revisit `/contracts`, confirm the new contract appears with the right status badge and estimated profit.
8. Revisit `/contractors`, confirm the contractor card is unaffected by contract deletion order (i.e. deleting the contract next does not delete the contractor).
9. Delete the contract.
10. Delete the contractor.
11. Delete the test client and quote.

Expected: every step succeeds, no console errors, and step 11 leaves Firestore exactly as it was before this task started (spot-check with a final Admin SDK read of the `contracts` and `contractors` collections — both should exclude every id created in this run).

- [ ] **Step 3: Mobile regression check on the two riskiest surfaces**

Reuse the exact narrow-viewport (320/360/375/390px) "More menu" bounding-box check from the earlier mobile bug fix, applied to:
1. The new "Convert to Contract" button on an accepted quote (added in Task 10) — confirm it doesn't push the existing "More" menu off-screen again.
2. The Contract detail page's status button row — confirm `overflow-x-auto` lets it scroll horizontally without breaking page layout (`document.documentElement.scrollWidth` should equal the viewport width, i.e. the status row scrolls internally, not the whole page).

Expected: both pass at every tested width.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git status --short   # confirm only intended files are staged
git commit -m "Contractor & Contract management (Phase 1): verified end-to-end"
git push origin main
```

Then confirm the Vercel deployment succeeds (`gh api repos/MuhammadRamzy/Mr.Solution-Billings/commits/<sha>/status` should report `state: success`) before telling the user this phase is live.

---

## Self-Review Notes

- **Spec coverage (Phase 1 scope only, per the user's explicit choice):** Contractor profiles ✓ (Task 6), Contract entity + simplified lifecycle ✓ (Task 1, 8), "Convert to Contract" from an accepted quote ✓ (Task 10), Team assignment ✓ (Task 7), workload is intentionally *not* a stored field — it's derivable later by counting contracts referencing a contractor, called out as a Phase 2+ concern, not a gap in Phase 1. Milestones ✓ (Task 7, 8). Budget/profit analytics ✓ (Task 2, 8, 9). Contractor compensation/payment tracking ✓ (Task 5, 8). Everything else in the original spec (sprints, time tracking, QA, documents, communication log, notifications, performance ratings, permissions/roles, client portal, e-signature, GitHub/payment-gateway/AI integrations) is explicitly out of scope per the user's own phase selection and is not silently dropped — it's deferred, not forgotten.
- **Placeholder scan:** no "TBD"/"handle appropriately"/unshown code — every step has real, complete code. The one deliberately-approximate value (`projectName: quote.invoiceNo` as the contract's initial project name in `convertQuoteToContractAction`) is explained inline as an editable default, not a placeholder.
- **Type consistency:** `Contract["status"]`, `Contract["milestones"][number]["status"]`, `ContractorPayment["method"]` are referenced by indexed-access types throughout rather than restated as separate string unions, so they can't drift from the Task 1 schema. `formatCurrency(..., "INR")` is used consistently rather than reading `profile.currency` (documented in Task 6 as a deliberate simplification, since `ContractsList`/`ContractorsList` don't currently receive a `BusinessProfile` prop — same as `ClientsList` today).
