/**
 * Server-side Stripe client and billing helpers.
 * Never import this module from client components.
 */

import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export async function createCustomer(
  email: string,
  name: string,
  metadata?: Stripe.MetadataParam
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

export async function attachPaymentMethodToCustomer(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  const stripe = getStripe();
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

export async function createSubscription(
  customerId: string,
  priceId: string,
  paymentMethodId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId,
    payment_behavior: 'error_if_incomplete',
  });
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const stripe = getStripe();
  await stripe.customers.del(customerId);
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
