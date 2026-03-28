'use client';

import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Loader2, Lock } from 'lucide-react';
import StripePaymentForm from '@/components/wizard/StripePaymentForm';

type LoadState = 'no_key' | 'loading' | 'ready' | 'error';

export default function ReviewPaymentPanel({
  publishableKey,
  onPaymentMethod,
  disabled,
}: {
  publishableKey: string;
  onPaymentMethod: (paymentMethodId: string) => Promise<void>;
  disabled: boolean;
}) {
  const resolvedKey =
    publishableKey?.trim() ||
    (typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ''
      : '');

  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    resolvedKey ? 'loading' : 'no_key'
  );

  useEffect(() => {
    if (!resolvedKey) {
      setStripe(null);
      setLoadState('no_key');
      return;
    }

    setLoadState('loading');
    setStripe(null);
    let cancelled = false;

    loadStripe(resolvedKey)
      .then((s) => {
        if (cancelled) return;
        if (s) {
          setStripe(s);
          setLoadState('ready');
        } else {
          setLoadState('error');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedKey]);

  if (loadState === 'no_key') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          Payments are not configured. Add{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
          </code>{' '}
          to <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{' '}
          and restart the dev server.
        </p>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-background py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Loading secure payment form…
        </p>
      </div>
    );
  }

  if (loadState === 'error' || !stripe) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          Could not load Stripe. Check that your publishable key is valid
          (starts with <code className="text-xs">pk_</code>) and that the
          browser can reach Stripe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <p className="text-xs leading-relaxed">
          Card details are processed securely by Stripe. We never store your
          full card number on our servers.
        </p>
      </div>
      <Elements
        stripe={stripe}
        options={{
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#bd1e2b',
              borderRadius: '8px',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            },
          },
        }}
      >
        <StripePaymentForm
          onPaymentMethod={onPaymentMethod}
          disabled={disabled}
        />
      </Elements>
    </div>
  );
}
