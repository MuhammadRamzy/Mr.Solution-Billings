import Navbar from "@/components/Navbar";
import { getBusinessProfile } from "@/lib/db";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getBusinessProfile();
  return (
    <div className="h-full bg-slate-50/50 text-slate-900 flex flex-col lg:flex-row overflow-hidden">
      <Navbar profile={profile} />
      <main className="flex-1 h-screen lg:pl-64 print:pl-0 flex flex-col relative w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrolling-touch p-4 sm:p-6 lg:p-8 pb-24 sm:pb-24 lg:pb-8 print:p-0 max-w-7xl print:max-w-full w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
