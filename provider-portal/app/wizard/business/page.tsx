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

const field =
  'w-full rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function WizardBusinessPage() {
  const router = useRouter();
  const [providerName, setProviderName] = useState('');
  const [state, setState] = useState('');
  const [suburb, setSuburb] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const wizardState = getWizardState();
    if (!wizardState.plan?.planRecordId) {
      router.replace('/wizard/plan');
      return;
    }
    if (wizardState.business) {
      setProviderName(wizardState.business.providerName);
      setState(wizardState.business.state);
      setSuburb(wizardState.business.suburb);
      setAddress(wizardState.business.address);
      setTimezone(wizardState.business.timezone);
    }
  }, [router]);

  const handleBack = () => {
    router.push('/wizard/user');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

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

    saveWizardState({
      business: {
        providerName: providerName.trim(),
        state,
        suburb: suburb.trim(),
        address: address.trim(),
        timezone,
      },
      currentStep: 4,
    });

    router.push('/wizard/logo');
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Business information
        </h2>
        <p className="mt-1 mb-6 text-sm leading-relaxed text-muted-foreground">
          Tell us about your organization
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="providerName"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Provider name *
            </label>
            <input
              type="text"
              id="providerName"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className={field}
              placeholder="Your organization name"
              required
            />
          </div>

          <div>
            <label
              htmlFor="state"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              State *
            </label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={field}
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

          <div>
            <label
              htmlFor="suburb"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Suburb *
            </label>
            <input
              type="text"
              id="suburb"
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              className={field}
              placeholder="Suburb or city"
              required
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Address *
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className={`${field} resize-none`}
              placeholder="Full street address"
              required
            />
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Timezone *
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={field}
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

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-2 text-sm font-semibold text-destructive">
                Please fix the following errors:
              </p>
              <ul className="list-inside list-disc space-y-1">
                {errors.map((err, index) => (
                  <li key={index} className="text-sm text-destructive">
                    {err}
                  </li>
                ))}
              </ul>
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
              {isSubmitting ? 'Saving...' : 'Next: Logo'}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}
