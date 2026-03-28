'use client';

import Link from 'next/link';
import { UserPlus, HeartPulse, BarChart3, Settings } from 'lucide-react';

const actions = [
  {
    title: 'Add employee',
    description: 'New team member',
    icon: UserPlus,
    path: '/dashboard/employees',
  },
  {
    title: 'Add patient',
    description: 'New participant',
    icon: HeartPulse,
    path: '/dashboard/patients',
  },
  {
    title: 'View reports',
    description: 'Analytics & logs',
    icon: BarChart3,
    path: '/dashboard/reports',
  },
  {
    title: 'Settings',
    description: 'Configuration',
    icon: Settings,
    path: '/dashboard/settings',
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.path}
            href={action.path}
            className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mt-3">
              {action.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {action.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
