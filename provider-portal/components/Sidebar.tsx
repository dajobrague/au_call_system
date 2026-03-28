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
  Calendar,
  Settings,
  FileText,
  Upload,
  Headphones,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import UserDropdown from './UserDropdown';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees Pool', path: '/dashboard/employees', icon: Users },
  { name: 'Patients', path: '/dashboard/patients', icon: Hospital },
  { name: 'Occurrences', path: '/dashboard/occurrences', icon: Calendar },
  { name: 'Reports', path: '/dashboard/reports', icon: FileText },
  { name: 'Operator', path: '/dashboard/operator', icon: Headphones },
  { name: 'Imports', path: '/dashboard/imports', icon: Upload },
  { name: 'Settings', path: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [providerLogo, setProviderLogo] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('Provider Portal');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  
  useEffect(() => {
    fetch('/api/provider/info')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.provider) {
          setProviderName((data.provider.fields.Name as string) || 'Provider Portal');
          const logo = data.provider.fields.Logo as Array<{ url: string }> | undefined;
          if (logo && Array.isArray(logo) && logo.length > 0) {
            setProviderLogo(logo[0].url);
          }
          
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

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };
  
  return (
    <div className="w-64 bg-card border-r border-border/60 h-full flex flex-col">
      <div className="p-6 border-b border-border/60 flex items-center justify-center">
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
          <h1 className="text-xl font-bold text-foreground text-center">{providerName}</h1>
        )}
      </div>
      
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
                active
                  ? 'bg-accent text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'w-[18px] h-[18px] shrink-0',
                active ? 'text-primary' : 'text-muted-foreground/70'
              )} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-3 border-t border-border/60">
        <UserDropdown userName={userName} userEmail={userEmail} />
      </div>
    </div>
  );
}
