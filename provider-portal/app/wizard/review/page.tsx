import ReviewWizardClient from './ReviewWizardClient';

export default function WizardReviewPage() {
  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';

  return <ReviewWizardClient stripePublishableKey={stripePublishableKey} />;
}
