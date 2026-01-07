'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface WizardLayoutProps {
  children: React.ReactNode;
}

const WIZARD_STEPS = [
  { step: 1, name: 'Account', path: '/wizard/user' },
  { step: 2, name: 'Business Info', path: '/wizard/business' },
  { step: 3, name: 'Logo', path: '/wizard/logo' },
  { step: 4, name: 'Greeting', path: '/wizard/greeting' },
  { step: 5, name: 'Transfer', path: '/wizard/transfer' },
  { step: 6, name: 'Review', path: '/wizard/review' },
];

export default function WizardLayout({ children }: WizardLayoutProps) {
  const pathname = usePathname();
  
  // Find current step based on pathname
  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.path === pathname);
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Compact Header Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <Image
              src="/On-Call-After-Hours-Logo-Updated-1.webp"
              alt="On-Call After Hours"
              width={140}
              height={70}
              className="object-contain"
              priority
            />
            <div className="text-right">
              <h1 className="text-xl font-bold text-gray-900">
                Provider Onboarding
              </h1>
              <p className="text-xs text-gray-600">
                Set up your account to get started
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">

        {/* Progress Stepper */}
        <div className="max-w-5xl mx-auto mb-12">
          <div className="relative">
            {/* Background Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-300" style={{ left: '20px', right: '20px' }} />
            
            {/* Steps */}
            <div className="relative flex justify-between">
              {WIZARD_STEPS.map((step) => (
                <div key={step.step} className="flex flex-col items-center">
                  {/* Circle */}
                  <div className="relative z-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 ${
                        currentStep > step.step
                          ? 'bg-green-500 text-white shadow-md'
                          : currentStep === step.step
                          ? 'bg-[#bd1e2b] text-white shadow-lg ring-4 ring-[#bd1e2b]/20'
                          : 'bg-white text-gray-400 border-2 border-gray-300'
                      }`}
                    >
                      {currentStep > step.step ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        step.step
                      )}
                    </div>
                  </div>
                  
                  {/* Label */}
                  <span
                    className={`mt-3 text-xs font-medium transition-colors duration-200 whitespace-nowrap ${
                      currentStep >= step.step
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Progress Line */}
            <div 
              className="absolute top-5 left-0 h-0.5 bg-[#bd1e2b] transition-all duration-300"
              style={{ 
                left: '20px',
                width: `calc(${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100}% - 40px)`
              }}
            />
          </div>
        </div>

        {/* Content Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

