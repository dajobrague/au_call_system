import { getCurrentUser } from '@/lib/auth';
import {
  getProviderById,
  getPricingPlanById,
  getUsageTrackingByProvider,
  parsePricingPlanFields,
} from '@/lib/airtable';
import { redirect } from 'next/navigation';
import BillingClient, { type BillingPayload } from './BillingClient';

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const provider = await getProviderById(user.providerId);
  if (!provider) {
    redirect('/dashboard');
  }

  const planLinks = provider.fields.Plan as string[] | undefined;
  const planRecord = planLinks?.[0]
    ? await getPricingPlanById(planLinks[0])
    : null;
  const usage = await getUsageTrackingByProvider(provider.id);

  const payload: BillingPayload = {
    success: true,
    provider: {
      id: provider.id,
      name: (provider.fields.Name as string) || 'Provider',
      subscriptionStatus: provider.fields['Subscription Status'] as
        | string
        | undefined,
      billingPeriodStart: provider.fields['Billing Period Start'] as
        | string
        | undefined,
      billingPeriodEnd: provider.fields['Billing Period End'] as
        | string
        | undefined,
    },
    plan: planRecord
      ? (() => {
          const p = parsePricingPlanFields(planRecord.fields);
          return {
            id: planRecord.id,
            name: p.name,
            priceMonthly: p.priceMonthly,
            inboundMinutes: p.inboundMinutes,
            outboundAttempts: p.outboundAttempts,
            smsIncluded: p.smsIncluded,
          };
        })()
      : null,
    usage: usage
      ? {
          inboundMinutesUsed:
            Number(usage.fields['Inbound Minutes Used']) || 0,
          outboundAttemptsUsed:
            Number(usage.fields['Outbound Attempts Used']) || 0,
          smsSent: Number(usage.fields['SMS Sent']) || 0,
          billingPeriodStart: usage.fields['Billing Period Start'] as
            | string
            | undefined,
          billingPeriodEnd: usage.fields['Billing Period End'] as
            | string
            | undefined,
        }
      : null,
  };

  return <BillingClient data={payload} />;
}
