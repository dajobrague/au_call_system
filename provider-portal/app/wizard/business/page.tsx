'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import {
  saveWizardState,
  getWizardState,
  AUSTRALIAN_STATES,
  AUSTRALIAN_TIMEZONES,
} from '@/lib/utils/wizard-storage';

export default function WizardBusinessPage() {
  const router = useRouter();
  const [providerName, setProviderName] = useState('');
  const [state, setState] = useState('');
  const [suburb, setSuburb] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved state
  useEffect(() => {
    const wizardState = getWizardState();
    if (wizardState.business) {
      setProviderName(wizardState.business.providerName);
      setState(wizardState.business.state);
      setSuburb(wizardState.business.suburb);
      setAddress(wizardState.business.address);
      setTimezone(wizardState.business.timezone);
    }
  }, []);

  const handleBack = () => {
    router.push('/wizard/user');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    // Validate required fields
    const newErrors: string[] = [];

    if (!providerName.trim()) {
      newErrors.push('Provider name is required');
    }
    if (!state) {
      newErrors.push('State is required');
    }
    if (!suburb.trim()) {
      newErrors.push('Suburb is required');
    }
    if (!address.trim()) {
      newErrors.push('Address is required');
    }
    if (!timezone) {
      newErrors.push('Timezone is required');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    // Save to wizard state
    saveWizardState({
      business: {
        providerName: providerName.trim(),
        state,
        suburb: suburb.trim(),
        address: address.trim(),
        timezone,
      },
      currentStep: 2,
    });

    // Navigate to next step
    router.push('/wizard/logo');
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Business Information
        </h2>
        <p className="text-gray-600 mb-6">
          Tell us about your organization
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Name */}
          <div>
            <label
              htmlFor="providerName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Provider Name *
            </label>
            <input
              type="text"
              id="providerName"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
              placeholder="Your organization name"
              required
            />
          </div>

          {/* State */}
          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              State *
            </label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
              required
            >
              <option value="">Select a state</option>
              {AUSTRALIAN_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Suburb */}
          <div>
            <label
              htmlFor="suburb"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Suburb *
            </label>
            <input
              type="text"
              id="suburb"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
              placeholder="Suburb or city"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Address *
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
              placeholder="Full street address"
              required
            />
          </div>

          {/* Timezone */}
          <div>
            <label
              htmlFor="timezone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Timezone *
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
              required
            >
              <option value="">Select a timezone</option>
              {AUSTRALIAN_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2">
                Please fix the following errors:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-[#bd1e2b] text-white rounded-lg font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Next: Logo'}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}

