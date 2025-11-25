/**
 * Provider Profile Configuration Component
 */

'use client';

import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import Image from 'next/image';

interface ProviderData {
  id: string;
  fields: {
    Name?: string;
    State?: string;
    Suburb?: string;
    Address?: string;
    'Greeting (IVR)'?: string;
    Logo?: Array<{
      url: string;
      filename: string;
    }>;
  };
}

export default function ProfileConfig() {
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    suburb: '',
    address: '',
    greeting: '',
  });
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  useEffect(() => {
    fetchProviderData();
  }, []);
  
  const fetchProviderData = async () => {
    try {
      const response = await fetch('/api/provider/info');
      const data = await response.json();
      
      if (data.success && data.provider) {
        setProvider(data.provider);
        setFormData({
          name: data.provider.fields.Name || '',
          state: data.provider.fields.State || '',
          suburb: data.provider.fields.Suburb || '',
          address: data.provider.fields.Address || '',
          greeting: data.provider.fields['Greeting (IVR)'] || '',
        });
        
        if (data.provider.fields.Logo && data.provider.fields.Logo.length > 0) {
          setLogoPreview(data.provider.fields.Logo[0].url);
        }
      }
    } catch {
      setError('Failed to load provider data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/provider/info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Name: formData.name,
            State: formData.state,
            Suburb: formData.suburb,
            Address: formData.address,
            'Greeting (IVR)': formData.greeting,
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Provider profile updated successfully!');
        setProvider(data.provider);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to update provider profile');
      }
    } catch {
      setError('An error occurred while updating provider profile');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Provider Profile Configuration</h2>
        <p className="text-sm text-gray-600 mt-1">Configure your provider information and greeting</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-700 hover:text-green-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Logo Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Provider Logo
          </label>
          {logoPreview && (
            <div className="mb-4">
              <Image
                src={logoPreview}
                alt="Provider Logo"
                width={200}
                height={80}
                className="object-contain border border-gray-200 rounded p-2"
                style={{ maxHeight: '80px' }}
              />
            </div>
          )}
          <div className="text-sm text-gray-500">
            <p>Logo management coming soon. Currently displaying your existing logo from Airtable.</p>
          </div>
        </div>
        
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Provider Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter provider name"
          />
        </div>
        
        {/* State */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
            State
          </label>
          <input
            id="state"
            type="text"
            value={formData.state}
            onChange={(e) => handleInputChange('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter state"
          />
        </div>
        
        {/* Suburb */}
        <div>
          <label htmlFor="suburb" className="block text-sm font-medium text-gray-700 mb-2">
            Suburb
          </label>
          <input
            id="suburb"
            type="text"
            value={formData.suburb}
            onChange={(e) => handleInputChange('suburb', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter suburb"
          />
        </div>
        
        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <input
            id="address"
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter address"
          />
        </div>
        
        {/* Greeting (IVR) */}
        <div>
          <label htmlFor="greeting" className="block text-sm font-medium text-gray-700 mb-2">
            Greeting (IVR)
          </label>
          <textarea
            id="greeting"
            value={formData.greeting}
            onChange={(e) => handleInputChange('greeting', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter the greeting that the AI will read when calls happen"
          />
          <p className="text-sm text-gray-500 mt-1">
            This greeting will be read by the AI voice agent when calls are received.
          </p>
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

