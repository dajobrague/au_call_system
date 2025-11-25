/**
 * Dashboard Home Page
 */

import { getCurrentUser } from '@/lib/auth';
import { getProviderById } from '@/lib/airtable';
import Link from 'next/link';
import { 
  Users, 
  Hospital, 
  ClipboardList, 
  Calendar,
  Settings,
  FileText
} from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }
  
  const provider = await getProviderById(user.providerId);
  
  const cards = [
    { 
      title: 'Admin Section', 
      path: '/dashboard/admin', 
      icon: Settings, 
      description: 'Configure your provider profile and settings',
      color: 'text-indigo-600 bg-indigo-50'
    },
    { 
      title: 'Reports', 
      path: '/dashboard/reports', 
      icon: FileText, 
      description: 'View daily reports and analytics',
      color: 'text-teal-600 bg-teal-50'
    },
    { 
      title: 'Employees Pool', 
      path: '/dashboard/employees', 
      icon: Users, 
      description: 'Add and manage employees',
      color: 'text-blue-600 bg-blue-50'
    },
    { 
      title: 'Patients', 
      path: '/dashboard/patients', 
      icon: Hospital, 
      description: 'Add and manage patients',
      color: 'text-green-600 bg-green-50'
    },
    { 
      title: 'Job Templates', 
      path: '/dashboard/job-templates', 
      icon: ClipboardList, 
      description: 'View job templates',
      color: 'text-purple-600 bg-purple-50'
    },
    { 
      title: 'Occurrences', 
      path: '/dashboard/occurrences', 
      icon: Calendar, 
      description: 'View scheduled occurrences',
      color: 'text-orange-600 bg-orange-50'
    },
  ];
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Hi, {user.firstName}
        </h1>
        {provider && (
          <p className="text-gray-600 mt-2">
            {(provider.fields.Name as string) || 'Provider Dashboard'}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.path}
              href={card.path}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{card.title}</h2>
              </div>
              <p className="text-gray-600 text-sm">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

