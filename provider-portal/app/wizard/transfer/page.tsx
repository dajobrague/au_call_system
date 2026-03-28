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

const field =
  'w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function WizardTransferPage() {
  const router = useRouter();
  const [transferNumber, setTransferNumber] = useState('');
  const [skipTransfer, setSkipTransfer] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const wizardState = getWizardState();
    if (!wizardState.plan?.planRecordId) {
      router.replace('/wizard/plan');
      return;
    }
    if (wizardState.transfer) {
      if (wizardState.transfer.transferNumber) {
        setTransferNumber(wizardState.transfer.transferNumber);
        setSkipTransfer(false);
      } else {
        setSkipTransfer(true);
      }
    }
  }, [router]);

  const handleBack = () => {
    router.push('/wizard/greeting');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (skipTransfer) {
      saveWizardState({
        transfer: {
          transferNumber: undefined,
        },
        currentStep: 7,
      });
      router.push('/wizard/review');
      return;
    }

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

    const normalized = normalizeAustralianPhone(transferNumber);

    saveWizardState({
      transfer: {
        transferNumber: normalized || undefined,
      },
      currentStep: 7,
    });

    router.push('/wizard/review');
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Transfer number
        </h2>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
          Add a phone number for call transfers (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 p-4">
            <div className="flex gap-3">
              <div className="shrink-0 text-amber-600" aria-hidden>
                <svg
                  className="h-5 w-5"
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
              <div>
                <h3 className="text-sm font-medium text-amber-900">
                  Optional but recommended
                </h3>
                <p className="mt-2 text-sm text-amber-800/90">
                  Without a transfer number, call transfers won&apos;t be
                  available until you add one later in your settings.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
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
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="skipTransfer" className="text-sm text-foreground">
              <span className="font-medium">Skip for now</span>
              <span className="text-muted-foreground">
                {' '}
                (I&apos;ll add this later)
              </span>
            </label>
          </div>

          {!skipTransfer && (
            <div>
              <label
                htmlFor="transferNumber"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Transfer number
              </label>
              <input
                type="tel"
                id="transferNumber"
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                className={field}
                placeholder="+61 4XX XXX XXX or 04XX XXX XXX"
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Accepts Australian mobile and landline numbers in any format
              </p>
              {transferNumber && validateAustralianPhone(transferNumber) && (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  ✓ Will be saved as:{' '}
                  {formatAustralianPhoneForDisplay(transferNumber)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Next: Review'}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}
