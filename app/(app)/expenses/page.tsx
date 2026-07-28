import React from "react";
import { getExpenses, getBusinessProfile } from "@/lib/db";
import ExpensesList from "@/components/ExpensesList";

export const revalidate = 0;

export default async function ExpensesPage() {
  const [expenses, profile] = await Promise.all([getExpenses(), getBusinessProfile()]);

  return <ExpensesList initialExpenses={expenses} profile={profile} />;
}
