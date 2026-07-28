import React from "react";
import { getBusinessProfile } from "@/lib/db";
import SettingsForm from "@/components/SettingsForm";

export const revalidate = 0;

export default async function SettingsPage() {
  const profile = await getBusinessProfile();
  return <SettingsForm initialProfile={profile} />;
}
