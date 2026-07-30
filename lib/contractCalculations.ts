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
