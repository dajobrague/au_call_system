'use client';

import { FormEvent, useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

// Stripe iframes do not resolve page CSS variables; use system stack.
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      lineHeight: '24px',
      color: '#1e293b',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': { color: '#94a3b8' },
    },
    invalid: {
      color: '#dc2626',
    },
  },
};

interface StripePaymentFormProps {
  onPaymentMethod: (paymentMethodId: string) => Promise<void>;
  disabled?: boolean;
}

export default function StripePaymentForm({
  onPaymentMethod,
  disabled,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled) return;

    const card = elements.getElement(CardElement);
    if (!card) {
      setError('Card field is not ready');
      return;
    }

    setLoading(true);
    setError('');

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    });

    if (pmError || !paymentMethod) {
      setError(pmError?.message || 'Could not validate card');
      setLoading(false);
      return;
    }

    try {
      await onPaymentMethod(paymentMethod.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Card details
        </label>
        <div className="min-h-[52px] rounded-md border border-border bg-background px-3.5 py-3 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 [&_.StripeElement]:min-h-[28px]">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading || disabled ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing payment…
          </>
        ) : (
          'Pay and create account'
        )}
      </button>
    </form>
  );
}
