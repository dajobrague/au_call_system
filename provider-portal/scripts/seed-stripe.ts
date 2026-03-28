/**
 * One-time script: create Product + 3 monthly AUD prices in Stripe test mode.
 * Run: npm run seed-stripe (requires STRIPE_SECRET_KEY in .env.local)
 */

// Load .env.local — tsx doesn't do this automatically
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  // .env.local not found — relying on process.env being set externally
}

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (e.g. from .env.local)');
  process.exit(1);
}

const stripe = new Stripe(key);

const plans = [
  {
    nickname: 'Starter',
    unitAmount: 24900,
    metadata: {
      plan: 'starter',
      inbound_minutes: '120',
      outbound_attempts: '25',
      sms: '100',
    },
  },
  {
    nickname: 'Growth',
    unitAmount: 44900,
    metadata: {
      plan: 'growth',
      inbound_minutes: '300',
      outbound_attempts: '60',
      sms: '250',
    },
  },
  {
    nickname: 'Pro',
    unitAmount: 74900,
    metadata: {
      plan: 'pro',
      inbound_minutes: '700',
      outbound_attempts: '140',
      sms: '600',
    },
  },
] as const;

async function main() {
  const product = await stripe.products.create({
    name: 'On Call After Hours',
    metadata: { app: 'provider-portal' },
  });

  console.log('Product:', product.id, product.name);

  for (const p of plans) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'aud',
      unit_amount: p.unitAmount,
      recurring: { interval: 'month' },
      nickname: p.nickname,
      metadata: { ...p.metadata },
    });
    console.log(`${p.nickname} — Price ID: ${price.id} (paste into Airtable "Stripe Price ID")`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
