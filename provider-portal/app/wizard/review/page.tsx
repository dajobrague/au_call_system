'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { getWizardState, clearWizardState, isWizardComplete } from '@/lib/utils/wizard-storage';
import { formatAustralianPhoneForDisplay } from '@/lib/utils/phone-utils';
import type { WizardState } from '@/lib/utils/wizard-storage';

export default function WizardReviewPage() {
  const router = useRouter();
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const state = getWizardState();
    setWizardState(state);

    // If wizard is not complete, redirect to first incomplete step
    if (!isWizardComplete(state)) {
      if (!state.user) {
        router.push('/wizard/user');
      } else if (!state.business) {
        router.push('/wizard/business');
      }
    }
  }, [router]);

  const handleBack = () => {
    router.push('/wizard/transfer');
  };

  const handleSubmit = async () => {
    if (!wizardState) return;

    setIsSubmitting(true);
    setError('');

    try {
      // Submit to API
      const response = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wizardState),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Clear wizard state
      clearWizardState();

      // Redirect to dashboard (user is now logged in via API)
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to submit wizard:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  if (!wizardState) {
    return (
      <WizardLayout>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Review & Submit
        </h2>
        <p className="text-gray-600 mb-6">
          Please review your information before submitting
        </p>

        <div className="space-y-6">
          {/* Account Information */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Account Information
              </h3>
              <button
                type="button"
                onClick={() => router.push('/wizard/user')}
                className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
              >
                Edit
              </button>
            </div>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">
                  {wizardState.user?.firstName} {wizardState.user?.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{wizardState.user?.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Password</dt>
                <dd className="text-sm text-gray-900">••••••••</dd>
              </div>
            </dl>
          </div>

          {/* Business Information */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Business Information
              </h3>
              <button
                type="button"
                onClick={() => router.push('/wizard/business')}
                className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
              >
                Edit
              </button>
            </div>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Provider Name</dt>
                <dd className="text-sm text-gray-900">{wizardState.business?.providerName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">State</dt>
                <dd className="text-sm text-gray-900">{wizardState.business?.state}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Suburb</dt>
                <dd className="text-sm text-gray-900">{wizardState.business?.suburb}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="text-sm text-gray-900">{wizardState.business?.address}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                <dd className="text-sm text-gray-900">{wizardState.business?.timezone}</dd>
              </div>
            </dl>
          </div>

          {/* Logo */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Logo</h3>
              <button
                type="button"
                onClick={() => router.push('/wizard/logo')}
                className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
              >
                Edit
              </button>
            </div>
            {wizardState.logo?.logoUrl ? (
              <div className="flex items-center space-x-3">
                <img
                  src={wizardState.logo.logoUrl}
                  alt="Provider logo"
                  className="w-16 h-16 object-contain border border-gray-200 rounded"
                />
                <span className="text-sm text-green-600">✓ Logo uploaded</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No logo uploaded</p>
            )}
          </div>

          {/* Greeting */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Greeting (IVR)
              </h3>
              <button
                type="button"
                onClick={() => router.push('/wizard/greeting')}
                className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
              >
                Edit
              </button>
            </div>
            {wizardState.greeting?.greetingText ? (
              <p className="text-sm text-gray-900">{wizardState.greeting.greetingText}</p>
            ) : (
              <p className="text-sm text-gray-500">No greeting set</p>
            )}
          </div>

          {/* Transfer Number */}
          <div className="pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Transfer Number
              </h3>
              <button
                type="button"
                onClick={() => router.push('/wizard/transfer')}
                className="text-sm text-[#bd1e2b] hover:text-[#9a1823]"
              >
                Edit
              </button>
            </div>
            {wizardState.transfer?.transferNumber ? (
              <p className="text-sm text-gray-900">
                {formatAustralianPhoneForDisplay(wizardState.transfer.transferNumber)}
              </p>
            ) : (
              <div className="flex items-start space-x-2">
                <svg
                  className="h-5 w-5 text-yellow-500 flex-shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  No transfer number set - call transfers will not be available
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}

