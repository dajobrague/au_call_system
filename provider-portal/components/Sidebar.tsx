/**
 * Sidebar Navigation Component
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Hospital, 
  ClipboardList, 
  Calendar,
  Settings,
  FileText
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import UserDropdown from './UserDropdown';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees Pool', path: '/dashboard/employees', icon: Users },
  { name: 'Patients', path: '/dashboard/patients', icon: Hospital },
  { name: 'Job Templates', path: '/dashboard/job-templates', icon: ClipboardList },
  { name: 'Occurrences', path: '/dashboard/occurrences', icon: Calendar },
  { name: 'Reports', path: '/dashboard/reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [providerLogo, setProviderLogo] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('Provider Portal');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  useEffect(() => {
    // Fetch provider info for logo
    fetch('/api/provider/info')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.provider) {
          setProviderName((data.provider.fields.Name as string) || 'Provider Portal');
          // Check if provider has logo attachment
          const logo = data.provider.fields.Logo as Array<{ url: string }> | undefined;
          if (logo && Array.isArray(logo) && logo.length > 0) {
            setProviderLogo(logo[0].url);
          }
          
          // Set user info from the response
          if (data.user) {
            const firstName = data.user.fields['First Name'] || '';
            const lastName = data.user.fields['Last Name'] || '';
            setUserName(`${firstName} ${lastName}`.trim());
            setUserEmail(data.user.fields['Email'] || '');
          }
        }
      })
      .catch(err => console.error('Failed to fetch provider info:', err));
  }, []);
  
  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200 flex items-center justify-center">
        {providerLogo ? (
          <div className="w-full">
            <Image 
              src={providerLogo} 
              alt={providerName}
              width={240}
              height={80}
              className="object-contain w-full h-auto"
              style={{ maxHeight: '80px' }}
            />
          </div>
        ) : (
          <h1 className="text-xl font-bold text-gray-900 text-center">{providerName}</h1>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <UserDropdown userName={userName} userEmail={userEmail} />
      </div>
    </div>
  );
}

