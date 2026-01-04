/**
 * Dashboard Layout with Sidebar
 */

import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div className="flex h-screen bg-gray-50 print:bg-white print:block print:h-auto">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto p-8 print:p-0 print:m-0 print:w-full print:overflow-visible">
        {children}
      </main>
    </div>
  );
}

