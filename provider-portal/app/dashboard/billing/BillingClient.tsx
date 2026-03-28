'use client';

import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

export interface BillingPayload {
  success: boolean;
  provider: {
    id: string;
    name: string;
    subscriptionStatus?: string;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
  };
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
    inboundMinutes: number;
    outboundAttempts: number;
    smsIncluded: number;
  } | null;
  usage: {
    inboundMinutesUsed: number;
    outboundAttemptsUsed: number;
    smsSent: number;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
  } | null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

function formatDate(s: string | undefined) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BillingClient({ data }: { data: BillingPayload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'Could not open portal');
      }
      window.location.href = json.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const plan = data.plan;
  const usage = data.usage;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Subscription and usage for {data.provider.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Current plan
          </h2>
          {plan ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium text-foreground">{plan.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Monthly</dt>
                <dd className="font-medium text-foreground">
                  {formatMoney(plan.priceMonthly)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize text-foreground">
                  {data.provider.subscriptionStatus?.replace(/_/g, ' ') || '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Period start</dt>
                <dd className="text-foreground">
                  {formatDate(data.provider.billingPeriodStart)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Period end</dt>
                <dd className="text-foreground">
                  {formatDate(data.provider.billingPeriodEnd)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No plan linked yet.</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Usage this period
          </h2>
          {plan && usage ? (
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Inbound minutes</span>
                <span className="text-foreground">
                  {usage.inboundMinutesUsed} / {plan.inboundMinutes}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Outbound attempts</span>
                <span className="text-foreground">
                  {usage.outboundAttemptsUsed} / {plan.outboundAttempts}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">SMS</span>
                <span className="text-foreground">
                  {usage.smsSent} / {plan.smsIncluded}
                </span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Usage data will appear once your billing period is active.
            </p>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Manage subscription
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Update payment method, change plan, or cancel in the secure Stripe
          customer portal.
        </p>
        {error && (
          <p className="text-sm text-destructive mb-3" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={openPortal}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-primary hover:bg-primary/90 disabled:bg-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          Manage subscription
        </button>
      </div>
    </div>
  );
}
