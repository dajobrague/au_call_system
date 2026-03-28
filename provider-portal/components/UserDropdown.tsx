/**
 * User Dropdown Component
 * Avatar dropdown with user menu options
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Users, LogOut, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserDropdownProps {
  userName?: string;
  userEmail?: string;
}

export default function UserDropdown({ userName, userEmail }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    router.push(path);
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150',
          isOpen
            ? 'bg-muted/50'
            : 'hover:bg-muted/50'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {getInitials(userName)}
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {userName || 'User'}
          </div>
          {userEmail && (
            <div className="text-xs text-muted-foreground truncate">
              {userEmail}
            </div>
          )}
        </div>
        
        <ChevronDown 
          className={cn(
            'w-4 h-4 text-muted-foreground/60 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => handleNavigate('/dashboard/profile')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <User className="w-4 h-4 text-muted-foreground/70" />
              <span>View Profile</span>
            </button>
            
            <button
              onClick={() => handleNavigate('/dashboard/organization-users')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Users className="w-4 h-4 text-muted-foreground/70" />
              <span>Organization Users</span>
            </button>
            
            <button
              onClick={() => handleNavigate('/dashboard/admin')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground/70" />
              <span>Admin Section</span>
            </button>
            
            <div className="border-t border-border/40 my-1" />
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
