'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState } from '@/lib/utils/wizard-storage';
import { Loader2 } from 'lucide-react';

interface PlanRow {
  id: string;
  name: string;
  priceMonthly: number;
  inboundMinutes: number;
  outboundAttempts: number;
  smsIncluded: number;
  stripePriceId: string;
  overageInbound?: number;
  overageOutbound?: number;
  overageSms?: number;
  multiLocation: boolean;
}

function formatAud(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(value);
}

export default function WizardPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wizard/plans');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load plans');
        }
        if (!cancelled) {
          setPlans(data.plans as PlanRow[]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load plans');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (plan: PlanRow) => {
    setSelectingId(plan.id);
    saveWizardState({
      plan: {
        planRecordId: plan.id,
        planName: plan.name,
        stripePriceId: plan.stripePriceId,
        priceMonthly: plan.priceMonthly,
      },
      currentStep: 2,
    });
    router.push('/wizard/user');
  };

  if (loading) {
    return (
      <WizardLayout>
        <div className="py-12 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading plans…</p>
        </div>
      </WizardLayout>
    );
  }

  if (error) {
    return (
      <WizardLayout>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </WizardLayout>
    );
  }

  const isPopular = (name: string) =>
    name.toLowerCase().includes('growth');

  return (
    <WizardLayout contentMaxWidthClass="max-w-5xl" noCard>
      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const popular = isPopular(plan.name);

          const features = [
            `${plan.inboundMinutes} inbound voice minutes`,
            `${plan.outboundAttempts} outbound call attempts`,
            `${plan.smsIncluded} SMS`,
            ...(plan.multiLocation ? ['Multi-location configuration'] : []),
          ];

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${
                popular
                  ? 'border-primary/30 ring-1 ring-primary/20'
                  : 'border-border/60'
              }`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Most popular
                  </span>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {formatAud(plan.priceMonthly)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="mt-6 flex flex-1 flex-col border-t border-border/40 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Includes
                </p>
                <ul className="mt-3 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="text-sm text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 border-t border-border/40 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Overages
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="text-xs text-muted-foreground">
                    Additional inbound voice: {formatAud(plan.overageInbound)}/min
                  </li>
                  <li className="text-xs text-muted-foreground">
                    Additional outbound attempt: {formatAud(plan.overageOutbound)}/each
                  </li>
                  <li className="text-xs text-muted-foreground">
                    Additional SMS: {formatAud(plan.overageSms)}/each
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  disabled={selectingId !== null || !plan.stripePriceId}
                  onClick={() => handleSelect(plan)}
                  className={`w-full justify-center rounded-lg px-6 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    popular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border bg-card text-foreground hover:bg-muted/50'
                  }`}
                >
                  {selectingId === plan.id ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Continue…
                    </span>
                  ) : (
                    'Select plan'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </WizardLayout>
  );
}
