import React from "react";
import { getBusinessProfile } from "@/lib/db";
import LoginForm from "@/components/LoginForm";

export const revalidate = 0;

export default async function LoginPage() {
  const profile = await getBusinessProfile();
  return <LoginForm profile={profile} />;
}
