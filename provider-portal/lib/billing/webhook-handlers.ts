import type Stripe from 'stripe';
import {
  findProviderByStripeCustomerId,
  updateProvider,
  resetUsageTracking,
  getUsageTrackingRecordsForProvider,
  findPricingPlanByStripePriceId,
} from '@/lib/airtable';
import { mapStripeSubscriptionStatusToAirtable } from '@/lib/billing/subscription-status';

function unixToDateOnly(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  if ('deleted' in customer && customer.deleted) return null;
  return customer.id;
}

export async function handleInvoicePaid(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return;

  const provider = await findProviderByStripeCustomerId(customerId);
  if (!provider) {
    console.error('invoice.paid: no provider for customer', customerId);
    return;
  }

  const linePeriod = invoice.lines?.data?.[0]?.period;
  const startUnix =
    invoice.period_start ?? linePeriod?.start ?? invoice.created;
  const endUnix = invoice.period_end ?? linePeriod?.end ?? invoice.created;
  const periodStart = unixToDateOnly(startUnix);
  const periodEnd = unixToDateOnly(endUnix);

  await updateProvider(provider.id, {
    'Subscription Status': 'active',
    'Billing Period Start': periodStart,
    'Billing Period End': periodEnd,
  });

  const records = await getUsageTrackingRecordsForProvider(provider.id);
  const match = records.find(
    (r) => (r.fields['Billing Period Start'] as string) === periodStart
  );
  const sorted = [...records].sort((a, b) => {
    const aStart = (a.fields['Billing Period Start'] as string) || '';
    const bStart = (b.fields['Billing Period Start'] as string) || '';
    return bStart.localeCompare(aStart);
  });
  const target = match ?? sorted[0];

  if (target) {
    await resetUsageTracking(target.id, periodStart, periodEnd);
  } else {
    console.warn(
      'invoice.paid: no usage tracking row for provider',
      provider.id
    );
  }
}

export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return;

  const provider = await findProviderByStripeCustomerId(customerId);
  if (!provider) {
    console.error(
      'invoice.payment_failed: no provider for customer',
      customerId
    );
    return;
  }

  await updateProvider(provider.id, {
    'Subscription Status': 'past_due',
  });

  console.error('invoice.payment_failed:', {
    providerId: provider.id,
    providerName: provider.fields.Name,
    invoiceId: invoice.id,
  });
}

export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return;

  const provider = await findProviderByStripeCustomerId(customerId);
  if (!provider) {
    console.error(
      'customer.subscription.updated: no provider for customer',
      customerId
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const updates: Record<string, unknown> = {
    'Subscription Status': mapStripeSubscriptionStatusToAirtable(
      subscription.status
    ),
    'Billing Period Start': unixToDateOnly(subscription.current_period_start),
    'Billing Period End': unixToDateOnly(subscription.current_period_end),
    'Stripe Subscription ID': subscription.id,
  };

  if (priceId) {
    const plan = await findPricingPlanByStripePriceId(priceId);
    if (plan) {
      updates.Plan = [plan.id];
    }
  }

  await updateProvider(provider.id, updates);
}

export async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return;

  const provider = await findProviderByStripeCustomerId(customerId);
  if (!provider) {
    console.error(
      'customer.subscription.deleted: no provider for customer',
      customerId
    );
    return;
  }

  await updateProvider(provider.id, {
    'Subscription Status': 'cancelled',
    Active: false,
    'Onboarding Status': 'suspended',
  });
}
