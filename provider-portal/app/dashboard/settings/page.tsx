/**
 * Provider Settings Page
 * Organization-level settings including on-call hours
 */

'use client';

import { useEffect, useState } from 'react';
import { Building2, Clock, Loader2, Check, Save } from 'lucide-react';

interface ProviderData {
  id: string;
  fields: {
    'Name': string;
    'Provider ID': number;
    'On-Call Start Time'?: string;
    'On-Call End Time'?: string;
    'State'?: string;
    'Suburb'?: string;
    'Timezone'?: string;
  };
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [onCallStartTime, setOnCallStartTime] = useState('17:00');
  const [onCallEndTime, setOnCallEndTime] = useState('09:00');
  
  useEffect(() => {
    fetchProviderSettings();
  }, []);
  
  const fetchProviderSettings = async () => {
    try {
      const response = await fetch('/api/provider/info');
      const data = await response.json();
      
      if (data.success && data.provider) {
        setProvider(data.provider);
        setOnCallStartTime(data.provider.fields['On-Call Start Time'] || '17:00');
        setOnCallEndTime(data.provider.fields['On-Call End Time'] || '09:00');
      } else {
        setError('Failed to load provider settings');
      }
    } catch {
      setError('An error occurred while loading settings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(onCallStartTime) || !timeRegex.test(onCallEndTime)) {
      setError('Please enter valid times in HH:MM format (e.g., 17:00)');
      return;
    }
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/provider/info', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'On-Call Start Time': onCallStartTime,
            'On-Call End Time': onCallEndTime,
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setProvider(data.provider);
        
        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || 'Failed to update settings');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const formatOnCallWindow = () => {
    if (!provider?.fields['On-Call Start Time'] || !provider?.fields['On-Call End Time']) {
      return 'Not configured';
    }
    
    const start = provider.fields['On-Call Start Time'];
    const end = provider.fields['On-Call End Time'];
    
    // Display in 24-hour format as-is
    return `${start} – ${end}`;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Organization Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your organization configuration</p>
      </div>
      
      {/* Settings Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <a
          href="/dashboard/settings"
          className="bg-card rounded-lg shadow-sm border-2 border-primary p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">On-Call Hours</h3>
          </div>
          <p className="text-sm text-muted-foreground">Configure your organization&apos;s on-call window for reports</p>
        </a>
        
        <a
          href="/dashboard/settings/outbound-calling"
          className="bg-card rounded-lg shadow-sm border border-border/60 p-6 hover:shadow-md hover:border-primary transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6 text-foreground/80" />
            <h3 className="text-lg font-semibold text-foreground">Outbound Calling</h3>
          </div>
          <p className="text-sm text-muted-foreground">Configure automated phone calls after SMS waves</p>
        </a>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          <span>Settings updated successfully!</span>
        </div>
      )}
      
      {/* Provider Information */}
      <div className="bg-card rounded-lg shadow-sm border border-border/60 p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Organization Information
        </h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Organization Name:</span>
            <span className="font-medium text-foreground">{provider?.fields['Name'] || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Provider ID:</span>
            <span className="font-medium text-foreground">{provider?.fields['Provider ID'] || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location:</span>
            <span className="font-medium text-foreground">
              {provider?.fields['Suburb'] && provider?.fields['State']
                ? `${provider.fields['Suburb']}, ${provider.fields['State']}`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current On-Call Window:</span>
            <span className="font-medium text-foreground">{formatOnCallWindow()}</span>
          </div>
        </div>
      </div>
      
      {/* On-Call Hours Configuration */}
      <form onSubmit={handleSubmit} className="bg-card rounded-lg shadow-sm border border-border/60 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            On-Call Hours Configuration
          </h2>
          
          <p className="text-sm text-muted-foreground mb-6">
            Set your organization&apos;s on-call window. This will appear in daily reports and help calculate
            response times. Use 24-hour format (HH:MM).
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-foreground/80 mb-1">
                Start Time (24h) *
              </label>
              <input
                type="time"
                id="startTime"
                value={onCallStartTime}
                onChange={(e) => setOnCallStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: 17:00 for 5:00 PM
              </p>
            </div>
            
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-foreground/80 mb-1">
                End Time (24h) *
              </label>
              <input
                type="time"
                id="endTime"
                value={onCallEndTime}
                onChange={(e) => setOnCallEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: 09:00 for 9:00 AM
              </p>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary">
              <strong>Preview:</strong> Your on-call window will be displayed as{' '}
              <span className="font-medium">
                {onCallStartTime} – {onCallEndTime}
              </span>
              {' '}(24-hour format)
            </p>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-border/60">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
