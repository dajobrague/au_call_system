/**
 * Admin Section Page
 * Provider profile configuration
 */

'use client';

import ProfileConfig from '@/components/data-entry/ProfileConfig';

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Section</h1>
        <p className="text-muted-foreground mt-1">Configure your provider profile and settings</p>
      </div>
      
      <div className="bg-card rounded-lg shadow p-6">
        <ProfileConfig />
      </div>
    </div>
  );
}


