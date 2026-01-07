'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';
import {
  validateAustralianPhone,
  normalizeAustralianPhone,
  formatAustralianPhoneForDisplay,
} from '@/lib/utils/phone-utils';

export default function WizardTransferPage() {
  const router = useRouter();
  const [transferNumber, setTransferNumber] = useState('');
  const [skipTransfer, setSkipTransfer] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved state
  useEffect(() => {
    const wizardState = getWizardState();
    if (wizardState.transfer) {
      if (wizardState.transfer.transferNumber) {
        setTransferNumber(wizardState.transfer.transferNumber);
        setSkipTransfer(false);
      } else {
        setSkipTransfer(true);
      }
    }
  }, []);

  const handleBack = () => {
    router.push('/wizard/greeting');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // If skipping, save empty transfer number
    if (skipTransfer) {
      saveWizardState({
        transfer: {
          transferNumber: undefined,
        },
        currentStep: 5,
      });
      router.push('/wizard/review');
      return;
    }

    // Validate phone number
    if (!transferNumber.trim()) {
      setError('Please enter a transfer number or check "Skip for now"');
      setIsSubmitting(false);
      return;
    }

    if (!validateAustralianPhone(transferNumber)) {
      setError('Please enter a valid Australian phone number');
      setIsSubmitting(false);
      return;
    }

    // Normalize phone number
    const normalized = normalizeAustralianPhone(transferNumber);

    // Save to wizard state
    saveWizardState({
      transfer: {
        transferNumber: normalized || undefined,
      },
      currentStep: 5,
    });

    // Navigate to next step
    router.push('/wizard/review');
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Transfer Number
        </h2>
        <p className="text-gray-600 mb-6">
          Add a phone number for call transfers (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warning Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Optional but Recommended
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Without a transfer number, call transfers won't be available until
                    you add one later in your settings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Skip Transfer Checkbox */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="skipTransfer"
                type="checkbox"
                checked={skipTransfer}
                onChange={(e) => {
                  setSkipTransfer(e.target.checked);
                  if (e.target.checked) {
                    setTransferNumber('');
                    setError('');
                  }
                }}
                className="w-4 h-4 text-[#bd1e2b] border-gray-300 rounded focus:ring-[#bd1e2b]"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="skipTransfer" className="font-medium text-gray-700">
                Skip for now (I'll add this later)
              </label>
            </div>
          </div>

          {/* Transfer Number Input */}
          {!skipTransfer && (
            <div>
              <label
                htmlFor="transferNumber"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Transfer Number
              </label>
              <input
                type="tel"
                id="transferNumber"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#bd1e2b] focus:border-transparent"
                placeholder="+61 4XX XXX XXX or 04XX XXX XXX"
              />
              <p className="text-xs text-gray-500 mt-1">
                Accepts Australian mobile and landline numbers in any format
              </p>
              {transferNumber && validateAustralianPhone(transferNumber) && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Will be saved as: {formatAustralianPhoneForDisplay(transferNumber)}
                </p>
              )}
            </div>
          )}

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
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-[#bd1e2b] text-white rounded-lg font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Next: Review'}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}

