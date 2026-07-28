import React from "react";
import { getExpenses, getBusinessProfile } from "@/lib/db";
import ExpensesList from "@/components/ExpensesList";

export const revalidate = 0;

export default async function ExpensesPage() {
  const expenses = await getExpenses();
  const profile = await getBusinessProfile();

  return <ExpensesList initialExpenses={expenses} profile={profile} />;
}
