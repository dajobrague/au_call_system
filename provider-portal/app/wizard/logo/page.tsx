'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WizardLayout from '@/components/wizard/WizardLayout';
import { saveWizardState, getWizardState } from '@/lib/utils/wizard-storage';

export default function WizardLogoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [skipLogo, setSkipLogo] = useState(false);

  // Load saved state
  useEffect(() => {
    const wizardState = getWizardState();
    if (wizardState.logo?.logoUrl) {
      setLogoPreview(wizardState.logo.logoUrl);
      setSkipLogo(false);
    } else {
      setSkipLogo(true);
    }
  }, []);

  const handleBack = () => {
    router.push('/wizard/business');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setLogoFile(file);
    setUploadError('');
    setSkipLogo(false);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsUploading(true);

    try {
      // If skipping or no logo, save empty state and continue
      if (skipLogo || !logoFile) {
        saveWizardState({
          logo: {
            logoUrl: undefined,
            logoS3Key: undefined,
          },
          currentStep: 3,
        });
        router.push('/wizard/greeting');
        return;
      }

      // Upload logo to S3
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch('/api/wizard/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo');
      }

      // Save logo URL to wizard state
      saveWizardState({
        logo: {
          logoUrl: data.url,
          logoS3Key: data.key,
        },
        currentStep: 3,
      });

      // Navigate to next step
      router.push('/wizard/greeting');
    } catch (err) {
      console.error('Failed to upload logo:', err);
      setUploadError(err instanceof Error ? err.message : 'An error occurred');
      setIsUploading(false);
    }
  };

  return (
    <WizardLayout>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Your Logo
        </h2>
        <p className="text-gray-600 mb-6">
          Add your organization's logo (optional)
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Skip Logo Checkbox */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="skipLogo"
                type="checkbox"
                checked={skipLogo}
                onChange={(e) => {
                  setSkipLogo(e.target.checked);
                  if (e.target.checked) {
                    handleRemoveLogo();
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="skipLogo" className="font-medium text-gray-700">
                Skip for now (I'll add this later)
              </label>
            </div>
          </div>

          {/* File Upload Area */}
          {!skipLogo && (
            <div>
              {!logoPreview ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#bd1e2b] transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="logoUpload"
                  />
                  <label
                    htmlFor="logoUpload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <svg
                      className="w-12 h-12 text-gray-400 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-[#bd1e2b] font-medium">
                      Click to upload
                    </span>
                    <span className="text-sm text-gray-500 mt-1">
                      PNG, JPG, GIF up to 5MB
                    </span>
                  </label>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-24 h-24 object-contain border border-gray-200 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {logoFile?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {logoFile && `${(logoFile.size / 1024).toFixed(1)} KB`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={isUploading}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-3 bg-[#bd1e2b] text-white rounded-lg font-semibold hover:bg-[#9a1823] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Next: Greeting'
              )}
            </button>
          </div>
        </form>
      </div>
    </WizardLayout>
  );
}

