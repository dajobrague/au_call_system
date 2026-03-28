/**
 * Map Stripe subscription.status to Airtable Provider "Subscription Status" single-select.
 */

const AIRTABLE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'cancelled',
  'incomplete',
]);

export function mapStripeSubscriptionStatusToAirtable(
  stripeStatus: string
): string {
  if (stripeStatus === 'canceled') {
    return 'cancelled';
  }
  if (AIRTABLE_STATUSES.has(stripeStatus)) {
    return stripeStatus;
  }
  if (stripeStatus === 'incomplete_expired') {
    return 'cancelled';
  }
  if (stripeStatus === 'unpaid' || stripeStatus === 'paused') {
    return 'past_due';
  }
  return 'incomplete';
}
