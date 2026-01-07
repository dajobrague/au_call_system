import { redirect } from 'next/navigation';

export default function WizardIndexPage() {
  // Redirect to the first step
  redirect('/wizard/user');
}

