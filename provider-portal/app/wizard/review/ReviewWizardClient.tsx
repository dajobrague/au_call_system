'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import ReviewPaymentPanel from '@/components/wizard/ReviewPaymentPanel';
import ReviewSummarySections from '@/components/wizard/ReviewSummarySections';
import PostPaymentOverlay from '@/components/wizard/PostPaymentOverlay';
import {
  getWizardState,
  clearWizardState,
  isWizardComplete,
} from '@/lib/utils/wizard-storage';
import type { WizardState } from '@/lib/utils/wizard-storage';
import { Loader2 } from 'lucide-react';

export default function ReviewWizardClient({
  stripePublishableKey,
}: {
  stripePublishableKey: string;
}) {
  const router = useRouter();
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [overlayStatus, setOverlayStatus] = useState<
    'hidden' | 'processing' | 'success' | 'error'
  >('hidden');

  useEffect(() => {
    const state = getWizardState();
    setWizardState(state);

    if (!isWizardComplete(state)) {
      if (!state.plan?.planRecordId) {
        router.push('/wizard/plan');
      } else if (!state.user) {
        router.push('/wizard/user');
      } else if (!state.business) {
        router.push('/wizard/business');
      }
    }
  }, [router]);

  const handleBack = () => {
    router.push('/wizard/transfer');
  };

  const handlePaymentMethod = async (paymentMethodId: string) => {
    if (!wizardState) return;

    setIsSubmitting(true);
    setError('');
    setOverlayStatus('processing');

    try {
      const response = await fetch('/api/wizard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...wizardState, paymentMethodId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      setOverlayStatus('success');
    } catch (err) {
      console.error('Failed to submit wizard:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      setOverlayStatus('error');
      setIsSubmitting(false);
    }
  };

  const handleOverlayComplete = useCallback(() => {
    clearWizardState();
    router.push('/dashboard');
  }, [router]);

  const handleOverlayRetry = useCallback(() => {
    setOverlayStatus('hidden');
    setError('');
    setIsSubmitting(false);
  }, []);

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(n);

  if (!wizardState) {
    return (
      <WizardLayout contentMaxWidthClass="max-w-5xl" noCard hideBrandPanel>
        <div className="rounded-xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout contentMaxWidthClass="max-w-5xl" noCard hideBrandPanel>
      {overlayStatus !== 'hidden' && (
        <PostPaymentOverlay
          status={overlayStatus}
          errorMessage={error}
          onComplete={handleOverlayComplete}
          onRetry={handleOverlayRetry}
        />
      )}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
          {/* Left: summary */}
          <div className="flex flex-col p-6 sm:p-8">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Your setup
            </h2>
            <p className="mt-1 mb-5 text-sm leading-relaxed text-muted-foreground">
              Review your details. Tap Edit to change any section.
            </p>

            <div>
              <ReviewSummarySections
                wizardState={wizardState}
                formatMoney={formatMoney}
              />
            </div>

            <div className="mt-6 shrink-0">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>

          {/* Right: payment */}
          <div className="flex flex-col border-t border-border/60 bg-muted/20 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Payment
            </h2>
            <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
              {wizardState.plan
                ? `${formatMoney(wizardState.plan.priceMonthly)}/month — billed after account creation.`
                : 'Enter your card to create your account.'}
            </p>

            <div className="flex-1">
              <ReviewPaymentPanel
                publishableKey={stripePublishableKey}
                onPaymentMethod={handlePaymentMethod}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
